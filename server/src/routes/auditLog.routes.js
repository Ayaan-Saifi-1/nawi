import { Router } from 'express';
import { getAuditLogs, verifyAuditChain } from '../controllers/auditLog.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();

router.use(authenticate);

router.get('/integrity', authorize('admin', 'auditor'), verifyAuditChain);
router.get('/', authorize('admin', 'reviewer', 'lab_admin', 'doca_officer', 'auditor'), getAuditLogs);

export default router;
