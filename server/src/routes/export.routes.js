import { Router } from 'express';
import {
  exportLegalMetrologyData,
  createExportJob,
  getExportJobStatus,
  downloadExportJob,
} from '../controllers/export.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();

router.use(authenticate);

router.get('/legal-metrology', authorize('admin', 'lab_admin', 'doca_officer', 'auditor'), exportLegalMetrologyData);
router.post('/jobs', authorize('admin', 'lab_admin', 'doca_officer', 'auditor'), createExportJob);
router.get('/jobs/:jobId', authorize('admin', 'lab_admin', 'doca_officer', 'auditor'), getExportJobStatus);
router.get('/jobs/:jobId/download', authorize('admin', 'lab_admin', 'doca_officer', 'auditor'), downloadExportJob);

export default router;
