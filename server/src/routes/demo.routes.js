import { Router } from 'express';
import { seedDemoData } from '../seed/seedDemoData.js';
import { TestSession } from '../models/TestSession.js';
import { Observation } from '../models/Observation.js';
import { Report } from '../models/Report.js';
import { Attachment } from '../models/Attachment.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { AppError } from '../utils/AppError.js';

const router = Router();

// Gate all demo routes behind ENABLE_DEMO env var
router.use((req, res, next) => {
  if (process.env.ENABLE_DEMO !== 'true') {
    return next(new AppError(404, 'NOT_FOUND', 'Demo endpoints are not enabled'));
  }
  next();
});

router.get('/status', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const sessionCount = await TestSession.countDocuments();
    res.json({
      success: true,
      data: {
        isDemoDataIncluded: sessionCount > 0,
        sessionCount,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/seed', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const result = await seedDemoData();
    res.json({
      success: true,
      message: 'Legal Metrology demo datasets populated successfully',
      data: { ...result, isDemoDataIncluded: true },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/clear', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    // Deliberately NOT clearing AuditLog — append-only audit trail by design
    await Promise.all([
      TestSession.deleteMany({}),
      Observation.deleteMany({}),
      Report.deleteMany({}),
      Attachment.deleteMany({}),
    ]);
    res.json({
      success: true,
      message: 'Demo test sessions cleared successfully',
      data: { isDemoDataIncluded: false, sessionCount: 0 },
    });
  } catch (error) {
    next(error);
  }
});

export default router;

