import path from 'path';
import fs from 'fs';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { Attachment } from '../models/Attachment.js';
import { TestSession } from '../models/TestSession.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { appendAuditLog } from '../services/auditLogger.service.js';
import { assertSessionAccess } from '../utils/tenantAccess.js';
import { sha256 } from '../utils/hash.js';
import { readStoredFile, removeStoredFile, storeFile } from '../services/fileStorage.service.js';

const uploadDir = path.join(process.cwd(), 'uploads', 'attachments');
if (!process.env.VERCEL && !fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

export const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: process.env.VERCEL === '1' ? 4 * 1024 * 1024 : 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
    if (!allowed.has(file.mimetype)) return cb(new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Only JPEG, PNG, WebP, PDF, DOCX, and text files are accepted'));
    cb(null, true);
  },
});

function validateMagicBytes(buffer) {
  const header = buffer.subarray(0, 12);

  // JPEG: FF D8 FF
  if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return true;
  // PNG: 89 50 4E 47
  if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47) return true;
  // PDF: 25 50 44 46 (%PDF)
  if (header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46) return true;
  // DOCX / ZIP: 50 4B 03 04 (PK..)
  if (header[0] === 0x50 && header[1] === 0x4b && header[2] === 0x03 && header[3] === 0x04) return true;
  // WebP: RIFF (52 49 46 46) + WEBP at offset 8
  if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46 &&
      header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50) return true;

  // Plain text / CSV: printable ASCII or UTF8 whitespace
  const isText = header.every(b => (b >= 9 && b <= 13) || (b >= 32 && b <= 126) || b === 0);
  if (isText) return true;

  return false;
}

export const uploadAttachment = asyncHandler(async (req, res) => {
  const session = await TestSession.findById(req.params.id);
  if (!session) {
    throw new AppError(404, 'NOT_FOUND', 'Test session not found');
  }

  let storedFile;
  let relativePath;
  try {
    await assertSessionAccess(req, session);

    if (!['draft', 'submitted'].includes(session.status)) {
      throw new AppError(
        409,
        'INVALID_STATE',
        'Attachments can only be added to draft or submitted test sessions'
      );
    }

    if (!req.file) {
      throw new AppError(400, 'VALIDATION_ERROR', 'File is required');
    }

    if (!validateMagicBytes(req.file.buffer)) {
      throw new AppError(400, 'INVALID_FILE_TYPE', 'File content magic bytes do not match expected signature');
    }

    const fileType = req.body.fileType;
    if (!['photo', 'document'].includes(fileType)) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        "fileType must be 'photo' or 'document'"
      );
    }

    const fileBuffer = req.file.buffer;
    const fileHash = sha256(fileBuffer);
    const extension = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
      'text/plain': '.txt',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    }[req.file.mimetype];
    relativePath = path.join('uploads', 'attachments', `attachment-${Date.now()}-${randomUUID()}${extension}`);
    storedFile = await storeFile(relativePath, fileBuffer);

    const attachment = await Attachment.create({
      testSessionId: session._id,
      fileType,
      filePath: relativePath,
      storageFileId: storedFile.storageFileId,
      originalFilename: req.file.originalname,
      uploadedBy: req.user.sub,
      sha256Hash: fileHash,
    });
    await appendAuditLog({ entityType: 'Attachment', entityId: attachment._id, action: 'upload', userId: req.user.sub, details: { sha256Hash: fileHash } });

    res.status(201).json({
      success: true,
      data: attachment,
    });
  } catch (err) {
    if (storedFile) await removeStoredFile({ storageFileId: storedFile.storageFileId, filePath: relativePath });
    throw err;
  }
});

export const getAttachments = asyncHandler(async (req, res) => {
  const session = await TestSession.findById(req.params.id);
  if (!session) {
    throw new AppError(404, 'NOT_FOUND', 'Test session not found');
  }

  await assertSessionAccess(req, session);

  const attachments = await Attachment.find({ testSessionId: session._id })
    .populate('uploadedBy', 'name email')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: attachments,
  });
});

export const downloadAttachment = asyncHandler(async (req, res) => {
  const attachment = await Attachment.findById(req.params.attachmentId);
  if (!attachment) throw new AppError(404, 'NOT_FOUND', 'Attachment not found');
  const session = await TestSession.findById(attachment.testSessionId);
  if (!session) throw new AppError(404, 'NOT_FOUND', 'Test session not found');
  await assertSessionAccess(req, session);

  const contents = await readStoredFile({
    storageFileId: attachment.storageFileId,
    filePath: attachment.filePath,
  });
  const filename = path.basename(attachment.originalFilename || attachment.filePath);
  const mimeType = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt': 'text/plain',
  }[path.extname(filename).toLowerCase()] || 'application/octet-stream';
  res.type(mimeType).attachment(filename).send(contents);
});
