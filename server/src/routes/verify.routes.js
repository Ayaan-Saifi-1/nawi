import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  lookupPublicReportsByInstrumentDetails,
  lookupReportsBySerialNumber,
  verifyReport,
} from '../controllers/verify.controller.js';

const router = Router();

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per IP per 15 minutes
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many verification attempts from this IP, please try again later.',
    },
  },
});

router.get('/lookup', verifyLimiter, lookupReportsBySerialNumber);
router.get('/lookup-details', verifyLimiter, lookupPublicReportsByInstrumentDetails);
router.get('/:reportNumberOrHash', verifyLimiter, verifyReport);

export default router;
