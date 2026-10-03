import { Manufacturer } from '../models/Manufacturer.js';
import { InstrumentModel } from '../models/InstrumentModel.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { appendAuditLog } from '../services/auditLogger.service.js';

function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

export const createManufacturer = asyncHandler(async (req, res) => {
  const { name, contactEmail, licenseNumber, contactPhone, address } = req.body;
  if (!name || !name.trim() || !contactEmail || !contactEmail.trim()) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Manufacturer name and contact email are required');
  }

  const manufacturer = await Manufacturer.create({
    name: name.trim(),
    contactEmail: contactEmail.trim().toLowerCase(),
    licenseNumber: licenseNumber ? licenseNumber.trim() : undefined,
    contactPhone: contactPhone ? contactPhone.trim() : undefined,
    address: address ? address.trim() : undefined,
  });

  await appendAuditLog({
    entityType: 'Manufacturer',
    entityId: manufacturer._id,
    action: 'create_manufacturer',
    userId: req.user._id,
    details: { name: manufacturer.name, licenseNumber: manufacturer.licenseNumber },
  });

  res.status(201).json({
    success: true,
    data: manufacturer,
  });
});

export const getManufacturers = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page || '1', 10);
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
  const skip = (page - 1) * limit;

  const query = {};

  // Manufacturer role can ONLY view its own assigned manufacturer record
  if (req.user.role === 'manufacturer') {
    if (!req.user.manufacturerRef) {
      return res.status(200).json({ success: true, data: [], meta: { page: 1, limit, total: 0, totalPages: 0 } });
    }
    query._id = req.user.manufacturerRef;
  } else if (req.query.search && req.query.search.trim()) {
    query.name = { $regex: escapeRegex(req.query.search.trim()), $options: 'i' };
  }

  const [manufacturers, total] = await Promise.all([
    Manufacturer.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }),
    Manufacturer.countDocuments(query),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;

  res.status(200).json({
    success: true,
    data: manufacturers,
    meta: {
      page,
      limit,
      total,
      totalPages,
    },
  });
});

export const updateManufacturer = asyncHandler(async (req, res) => {
  const { name, contactEmail, licenseNumber, contactPhone, address } = req.body;
  const updateData = {};
  if (name !== undefined) updateData.name = name.trim();
  if (contactEmail !== undefined) updateData.contactEmail = contactEmail.trim().toLowerCase();
  if (licenseNumber !== undefined) updateData.licenseNumber = licenseNumber.trim();
  if (contactPhone !== undefined) updateData.contactPhone = contactPhone.trim();
  if (address !== undefined) updateData.address = address.trim();

  const manufacturer = await Manufacturer.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
  if (!manufacturer) {
    throw new AppError(404, 'NOT_FOUND', 'Manufacturer not found');
  }

  await appendAuditLog({
    entityType: 'Manufacturer',
    entityId: manufacturer._id,
    action: 'update_manufacturer',
    userId: req.user._id,
    details: updateData,
  });

  res.status(200).json({ success: true, data: manufacturer });
});

export const deleteManufacturer = asyncHandler(async (req, res) => {
  const modelCount = await InstrumentModel.countDocuments({ manufacturerId: req.params.id });
  if (modelCount > 0) {
    throw new AppError(409, 'MANUFACTURER_IN_USE', `Cannot delete manufacturer because ${modelCount} instrument model(s) reference it.`);
  }

  const manufacturer = await Manufacturer.findByIdAndDelete(req.params.id);
  if (!manufacturer) {
    throw new AppError(404, 'NOT_FOUND', 'Manufacturer not found');
  }

  await appendAuditLog({
    entityType: 'Manufacturer',
    entityId: manufacturer._id,
    action: 'delete_manufacturer',
    userId: req.user._id,
    details: { name: manufacturer.name },
  });

  res.status(200).json({ success: true, message: 'Manufacturer deleted successfully' });
});
