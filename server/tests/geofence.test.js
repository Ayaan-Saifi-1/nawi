import { distanceBetweenCoordinatesM, verifyGeofence } from '../src/utils/geofence.js';

describe('Laboratory geofence verification', () => {
  test('allows laboratories without a configured boundary', () => {
    expect(verifyGeofence({ geofence: {} }, null)).toEqual({ status: 'not_configured', distanceM: null });
  });

  test('accepts a current location inside the configured boundary', () => {
    const location = { latitude: 28.6139, longitude: 77.209, accuracyM: 5, capturedAt: new Date().toISOString() };
    const result = verifyGeofence({ geofence: { latitude: 28.6139, longitude: 77.209, radiusM: 250 } }, location);
    expect(result.status).toBe('verified');
    expect(result.distanceM).toBeLessThan(1);
  });

  test('rejects a location outside the configured boundary', () => {
    expect(() => verifyGeofence(
      { geofence: { latitude: 28.6139, longitude: 77.209, radiusM: 50 } },
      { latitude: 28.62, longitude: 77.209, accuracyM: 5, capturedAt: new Date().toISOString() }
    )).toThrow('outside the configured laboratory boundary');
    expect(distanceBetweenCoordinatesM(28.6139, 77.209, 28.6139, 77.209)).toBe(0);
  });
});
