import { Router } from 'express';
import { getLaboratories, createLaboratory, updateLaboratory, deleteLaboratory } from '../controllers/laboratory.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();

router.use(authenticate);

router.get('/', getLaboratories);
router.post('/', authorize('admin', 'doca_officer'), createLaboratory);
router.patch('/:id', authorize('admin', 'lab_admin'), updateLaboratory);
router.delete('/:id', authorize('admin', 'lab_admin'), deleteLaboratory);

export default router;
