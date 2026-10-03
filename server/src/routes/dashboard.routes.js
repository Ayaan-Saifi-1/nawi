import { Router } from 'express';
import { getDashboardStats } from '../controllers/dashboard.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();

router.use(authenticate);

router.get('/stats', authorize('admin', 'reviewer', 'lab_technician', 'lab_admin', 'doca_officer', 'manufacturer', 'auditor', 'metrology_expert'), getDashboardStats);

export default router;
