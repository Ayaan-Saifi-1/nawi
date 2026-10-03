import { Laboratory } from '../models/Laboratory.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { appendAuditLog } from '../services/auditLogger.service.js';

function parseGeofence(geofence) {
  if (!geofence || [geofence.latitude, geofence.longitude, geofence.radiusM].every((value) => value === '' || value === null || value === undefined)) {
    return { latitude: null, longitude: null, radiusM: null };
  }
  const latitude = Number(geofence.latitude);
  const longitude = Number(geofence.longitude);
  const radiusM = Number(geofence.radiusM);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
      !Number.isFinite(radiusM) || radiusM < 10 || radiusM > 10000) {
    throw new AppError(400, 'VALIDATION_ERROR', 'GPS latitude, longitude and radius must be valid; radius must be between 10 and 10000 metres');
  }
  return { latitude, longitude, radiusM };
}

export const getLaboratories = asyncHandler(async (req, res) => {
  const labs = await Laboratory.find({ isActive: true }).sort({ labName: 1 });
  res.status(200).json({
    success: true,
    data: labs,
  });
});

export const createLaboratory = asyncHandler(async (req, res) => {
  const { code, name, location, contactEmail, accreditationNumber, geofence } = req.body;
  const existing = await Laboratory.findOne({ labId: code });
  if (existing) {
    throw new AppError(409, 'CONFLICT', 'Laboratory code already exists');
  }

  const lab = await Laboratory.create({
    labId: code,
    labName: name,
    location,
    contactEmail,
    accreditationNo: accreditationNumber,
    geofence: parseGeofence(geofence),
  });
  await appendAuditLog({ entityType: 'Laboratory', entityId: lab._id, action: 'create', userId: req.user.sub });

  res.status(201).json({
    success: true,
    data: lab,
  });
});

export const updateLaboratory = asyncHandler(async (req, res) => {
  const query = req.user.role === 'lab_admin'
    ? { _id: req.params.id, labId: req.user.labId || null }
    : { _id: req.params.id };
  const updates = {};
  for (const field of ['labName', 'accreditationNo', 'location', 'contactEmail']) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  if (req.body.geofence !== undefined) updates.geofence = parseGeofence(req.body.geofence);
  const lab = await Laboratory.findOneAndUpdate(query, updates, { new: true, runValidators: true });
  if (!lab) {
    throw new AppError(404, 'NOT_FOUND', 'Laboratory not found');
  }
  await appendAuditLog({ entityType: 'Laboratory', entityId: lab._id, action: 'update', userId: req.user.sub });
  res.status(200).json({ success: true, data: lab });
});

export const deleteLaboratory = asyncHandler(async (req, res) => {
  const query = req.user.role === 'lab_admin'
    ? { _id: req.params.id, labId: req.user.labId || null }
    : { _id: req.params.id };
  const lab = await Laboratory.findOneAndUpdate(query, { isActive: false }, { new: true });
  if (!lab) {
    throw new AppError(404, 'NOT_FOUND', 'Laboratory not found');
  }
  await appendAuditLog({ entityType: 'Laboratory', entityId: lab._id, action: 'deactivate', userId: req.user.sub });
  res.status(200).json({ success: true, message: 'Laboratory deactivated successfully' });
});
