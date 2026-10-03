import { Router } from 'express';
import { getTestTypes, createTestType, updateTestType, approveTestType } from '../controllers/testType.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();

router.use(authenticate);

router.get('/', getTestTypes);
router.post('/', authorize('admin', 'metrology_expert'), createTestType);
router.patch('/:id', authorize('admin', 'metrology_expert'), updateTestType);
router.post('/:id/approve', authorize('admin', 'metrology_expert'), approveTestType);

export default router;
