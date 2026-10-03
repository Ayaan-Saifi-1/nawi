import { Router } from 'express';
import {
  uploadAttachment,
  getAttachments,
  downloadAttachment,
  multerUpload,
} from '../controllers/attachment.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();

router.use(authenticate);

router.post(
  '/:id/attachments',
  authorize('admin', 'lab_technician', 'lab_admin'),
  multerUpload.single('file'),
  uploadAttachment
);

router.get('/:id/attachments', getAttachments);
router.get('/attachments/:attachmentId/file', downloadAttachment);

export default router;
