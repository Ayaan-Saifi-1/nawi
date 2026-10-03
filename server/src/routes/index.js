import { Router } from 'express';
import authRoutes from './auth.routes.js';
import manufacturerRoutes from './manufacturer.routes.js';
import instrumentModelRoutes from './instrumentModel.routes.js';
import ruleConfigRoutes from './ruleConfig.routes.js';
import testSessionRoutes from './testSession.routes.js';
import attachmentRoutes from './attachment.routes.js';
import reportRoutes from './report.routes.js';
import verifyRoutes from './verify.routes.js';
import auditLogRoutes from './auditLog.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import exportRoutes from './export.routes.js';
import demoRoutes from './demo.routes.js';
import laboratoryRoutes from './laboratory.routes.js';
import testTypeRoutes from './testType.routes.js';
import userRoutes from './user.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/manufacturers', manufacturerRoutes);
router.use('/instrument-models', instrumentModelRoutes);
router.use('/rule-configs', ruleConfigRoutes);
router.use('/test-sessions', testSessionRoutes);
router.use('/test-sessions', attachmentRoutes);
router.use('/reports', reportRoutes);
router.use('/verify', verifyRoutes);
router.use('/audit-log', auditLogRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/export', exportRoutes);
router.use('/demo', demoRoutes);
router.use('/laboratories', laboratoryRoutes);
router.use('/test-types', testTypeRoutes);

export default router;
