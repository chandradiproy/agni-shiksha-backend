import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import {
  getMyNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  registerDeviceToken,
  unregisterDeviceToken,
} from '../../controllers/student/notification.controller';

const router = Router();

router.use(requireAuth);

router.get('/', getMyNotifications);
router.get('/unread-count', getUnreadNotificationCount);
router.patch('/read-all', markAllNotificationsAsRead);
router.patch('/:id/read', markNotificationAsRead);
router.post('/device-token', registerDeviceToken);
router.delete('/device-token', unregisterDeviceToken);

export default router;
