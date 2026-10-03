import { Router } from 'express';
import {
  listReports,
  createReport,
  getReportById,
  downloadReportFile,
  revokeReport,
  publishReport,
  archiveReport,
} from '../controllers/report.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();

router.use(authenticate);

router.get('/', listReports);
router.post('/:sessionId/generate', authorize('admin', 'reviewer'), createReport);
router.get('/:id', getReportById);
router.get('/:id/download/:format', downloadReportFile);
router.post('/:id/publish', authorize('admin', 'reviewer'), publishReport);
router.post('/:id/archive', authorize('admin', 'reviewer'), archiveReport);
router.post('/:id/revoke', authorize('admin', 'reviewer'), revokeReport);

export default router;
