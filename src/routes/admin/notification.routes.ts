import { Router } from 'express';
import { requireAdmin } from '../../middlewares/adminAuth';
import {
  createNotification,
  getNotifications,
} from '../../controllers/admin/notification.controller';

const router = Router();

router.use(requireAdmin);

router.get('/', getNotifications);
router.post('/', createNotification);

export default router;
