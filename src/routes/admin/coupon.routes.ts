// src/routes/admin/coupon.routes.ts
import { Router } from 'express';
import { requireAdmin } from '../../middlewares/adminAuth';
import { 
  createCoupon, 
  getAllCoupons, 
  updateCoupon,
  deleteCoupon,
  toggleCouponStatus 
} from '../../controllers/admin/coupon.controller';

const router = Router();
router.use(requireAdmin);

router.post('/', createCoupon);
router.get('/', getAllCoupons);
router.put('/:id', updateCoupon);
router.delete('/:id', deleteCoupon);
router.put('/:id/status', toggleCouponStatus);

export default router;