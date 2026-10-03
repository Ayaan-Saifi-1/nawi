import { Router } from 'express';
import {
  createTestSession,
  updateTestSession,
  addObservations,
  updateObservation,
  deleteObservation,
  submitTestSession,
  approveTestSession,
  rejectTestSession,
  getTestSessions,
  getTestSessionById,
  batchSyncTestSessions,
  acknowledgeObservationFlag,
} from '../controllers/testSession.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { createTestSessionSchema } from '../validators/testSession.schema.js';
import { addObservationsSchema, updateObservationSchema } from '../validators/observation.schema.js';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  authorize('admin', 'lab_technician', 'lab_admin'),
  validate(createTestSessionSchema),
  createTestSession
);

router.patch(
  '/:id',
  authorize('admin', 'lab_technician', 'lab_admin'),
  updateTestSession
);

router.post(
  '/:id/observations',
  authorize('admin', 'lab_technician', 'lab_admin'),
  validate(addObservationsSchema),
  addObservations
);

router.patch(
  '/:id/observations/:obsId',
  authorize('admin', 'lab_technician', 'lab_admin'),
  validate(updateObservationSchema),
  updateObservation
);

router.delete(
  '/:id/observations/:obsId',
  authorize('admin', 'lab_technician', 'lab_admin'),
  deleteObservation
);

router.post(
  '/:id/observations/:obsId/acknowledge-flag',
  authorize('admin', 'reviewer'),
  acknowledgeObservationFlag
);

router.post(
  '/:id/submit',
  authorize('admin', 'lab_technician', 'lab_admin'),
  submitTestSession
);

router.post(
  '/:id/approve',
  authorize('admin', 'reviewer'),
  approveTestSession
);

router.post(
  '/:id/reject',
  authorize('admin', 'reviewer'),
  rejectTestSession
);

router.get('/', getTestSessions);
router.get('/:id', getTestSessionById);

router.post('/sync/batch', authorize('admin', 'lab_technician', 'lab_admin'), batchSyncTestSessions);

export default router;

