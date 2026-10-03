import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import mongoose from 'mongoose';
import { AppError } from '../utils/AppError.js';

const localRoot = path.resolve(process.cwd());
const bucketName = 'nawiFiles';

function getGridFsBucket() {
  const database = mongoose.connection.db;
  if (!database) throw new Error('MongoDB must be connected before accessing file storage');
  return new mongoose.mongo.GridFSBucket(database, { bucketName });
}

function getLocalPath(relativePath) {
  const absolutePath = path.resolve(localRoot, relativePath);
  if (!absolutePath.startsWith(`${localRoot}${path.sep}`)) {
    throw new AppError(400, 'INVALID_FILE_PATH', 'File path is invalid');
  }
  return absolutePath;
}

export async function storeFile(relativePath, contents) {
  if (process.env.VERCEL === '1') {
    const bucket = getGridFsBucket();
    const upload = bucket.openUploadStream(relativePath, {
      metadata: { relativePath },
    });
    await new Promise((resolve, reject) => {
      upload.once('error', reject);
      upload.once('finish', resolve);
      Readable.from([contents]).pipe(upload);
    });
    return { storageFileId: upload.id.toString() };
  }

  const absolutePath = getLocalPath(relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, contents);
  return { storageFileId: null };
}

export async function readStoredFile({ storageFileId, filePath }) {
  if (storageFileId) {
    if (!mongoose.isValidObjectId(storageFileId)) {
      throw new AppError(404, 'FILE_NOT_FOUND', 'Stored file is unavailable');
    }
    try {
      const stream = getGridFsBucket().openDownloadStream(new mongoose.Types.ObjectId(storageFileId));
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      return Buffer.concat(chunks);
    } catch (error) {
      if (error.code === 26 || error.code === 'ENOENT') {
        throw new AppError(404, 'FILE_NOT_FOUND', 'Stored file is unavailable');
      }
      throw error;
    }
  }

  try {
    return await fs.readFile(getLocalPath(filePath));
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new AppError(404, 'FILE_NOT_FOUND', 'Stored file is unavailable');
    }
    throw error;
  }
}

export async function removeStoredFile({ storageFileId, filePath }) {
  if (storageFileId) {
    if (!mongoose.isValidObjectId(storageFileId)) return;
    try {
      await getGridFsBucket().delete(new mongoose.Types.ObjectId(storageFileId));
    } catch (error) {
      if (error.code !== 26) throw error;
    }
    return;
  }

  if (filePath) {
    await fs.rm(getLocalPath(filePath), { force: true });
  }
}
