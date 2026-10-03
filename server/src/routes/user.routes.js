import { Router } from 'express';
import { getUsers, updateUser, deleteUser, createUser, scopeUserCreation } from '../controllers/user.controller.js';
import { validate } from '../middleware/validate.js';
import { registerSchema } from '../validators/auth.schema.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();

router.use(authenticate);

router.get('/', authorize('admin', 'lab_admin'), getUsers);
router.post('/', authorize('admin', 'lab_admin'), scopeUserCreation, validate(registerSchema), createUser);
router.patch('/:id', authorize('admin', 'lab_admin'), updateUser);
router.delete('/:id', authorize('admin', 'lab_admin'), deleteUser);

export default router;