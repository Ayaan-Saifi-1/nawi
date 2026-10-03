import { Router } from 'express';
import { createManufacturer, getManufacturers, updateManufacturer, deleteManufacturer } from '../controllers/manufacturer.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();

router.use(authenticate);

router.post('/', authorize('admin', 'doca_officer'), createManufacturer);
router.get('/', getManufacturers);
router.patch('/:id', authorize('admin', 'doca_officer'), updateManufacturer);
router.delete('/:id', authorize('admin', 'doca_officer'), deleteManufacturer);

export default router;
