import { AppError } from './AppError.js';

export function distanceBetweenCoordinatesM(latitude1, longitude1, latitude2, longitude2) {
  const earthRadiusM = 6371000;
  const toRadians = (value) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(latitude2 - latitude1);
  const longitudeDelta = toRadians(longitude2 - longitude1);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(latitude1)) * Math.cos(toRadians(latitude2)) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function verifyGeofence(laboratory, clientLocation) {
  const boundary = laboratory.geofence;
  if (!boundary?.latitude && boundary?.latitude !== 0) {
    return { status: 'not_configured', distanceM: null };
  }
  if (!clientLocation) {
    throw new AppError(422, 'LOCATION_REQUIRED', 'Device location is required for this laboratory');
  }
  const capturedAt = new Date(clientLocation.capturedAt);
  if (!Number.isFinite(clientLocation.latitude) || !Number.isFinite(clientLocation.longitude) ||
      !Number.isFinite(clientLocation.accuracyM) || clientLocation.accuracyM > 100 ||
      Number.isNaN(capturedAt.getTime()) || Math.abs(Date.now() - capturedAt.getTime()) > 300000) {
    throw new AppError(422, 'LOCATION_INVALID', 'Device location is missing, inaccurate, or stale');
  }
  const distanceM = distanceBetweenCoordinatesM(boundary.latitude, boundary.longitude, clientLocation.latitude, clientLocation.longitude);
  if (distanceM > boundary.radiusM + clientLocation.accuracyM) {
    throw new AppError(422, 'OUTSIDE_GEOFENCE', 'Device is outside the configured laboratory boundary');
  }
  return { status: 'verified', distanceM, capturedAt };
}
