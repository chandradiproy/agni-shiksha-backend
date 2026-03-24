// src/controllers/admin/coupon.controller.ts

import { Request, Response } from 'express';
import prisma from '../../config/db';

import { CacheService } from '../../services/cache.service';
import { QueueService } from '../../services/queue.service';

const CACHE_TAG = 'premium';
// ==========================================
// 1. CREATE COUPON
// ==========================================
export const createCoupon = async (req: Request, res: Response) => {
  try {
    const { code, discount_type, discount_value, max_uses, valid_until, applicable_plan_id, is_active } = req.body;
    const adminId = (req as any).admin?.id as string;

    if (!code || !discount_type || discount_value === undefined) {
      return res.status(400).json({ error: 'Code, discount type, and value are required.' });
    }

    const newCoupon = await prisma.coupon.create({
      data: {
        code: code.toUpperCase(), // Normalize to uppercase
        discount_type,
        discount_value: Number(discount_value),
        max_uses: max_uses ? Number(max_uses) : null,
        valid_until: valid_until ? new Date(valid_until) : null,
        applicable_plan_id: applicable_plan_id || null,
        is_active: is_active ?? true // Accept status from frontend, default to true
      }
    });

    // Audit Log
    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId,
        action: 'CREATED_COUPON',
        target_id: newCoupon.id,
        details: { code: newCoupon.code, discount_value }
      }
    });
    await CacheService.invalidateTag(CACHE_TAG);
    await QueueService.enqueueSilentSync(CACHE_TAG);

    res.status(201).json({ success: true, message: 'Coupon created successfully', data: newCoupon });
  } catch (error: any) {
    console.error('Create Coupon Error:', error);
    if (error.code === 'P2002') return res.status(400).json({ error: 'Coupon code already exists' });
    res.status(500).json({ error: 'Failed to create coupon' });
  }
};

// ==========================================
// 2. GET ALL COUPONS
// ==========================================
export const getAllCoupons = async (req: Request, res: Response) => {
  try {
    const coupons = await prisma.coupon.findMany({
      orderBy: { created_at: 'desc' },
      include: { 
        applicable_plan: { select: { name: true } },
        _count: { select: { payments: true } } // Show admin how many times it was actually used in payments
      }
    });
    res.status(200).json({ success: true, data: coupons });
  } catch (error) {
    console.error('Fetch Coupons Error:', error);
    res.status(500).json({ error: 'Failed to fetch coupons' });
  }
};

// ==========================================
// 3. UPDATE COUPON
// ==========================================
export const updateCoupon = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { code, discount_type, discount_value, max_uses, valid_until, applicable_plan_id, is_active } = req.body;
    const adminId = (req as any).admin?.id as string;

    const existingCoupon = await prisma.coupon.findUnique({ where: { id: id as string } });
    if (!existingCoupon) return res.status(404).json({ error: 'Coupon not found' });

    const updatedCoupon = await prisma.coupon.update({
      where: { id: id as string },
      data: {
        code: code ? code.toUpperCase() : undefined,
        discount_type,
        discount_value: discount_value !== undefined ? Number(discount_value) : undefined,
        max_uses: max_uses !== undefined ? (max_uses === null ? null : Number(max_uses)) : undefined,
        valid_until: valid_until !== undefined ? (valid_until === null ? null : new Date(valid_until)) : undefined,
        applicable_plan_id: applicable_plan_id !== undefined ? applicable_plan_id : undefined,
        is_active: is_active !== undefined ? is_active : undefined
      }
    });

    // Audit Log
    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId,
        action: 'UPDATED_COUPON',
        target_id: updatedCoupon.id,
        details: { code: updatedCoupon.code }
      }
    });

    await CacheService.invalidateTag(CACHE_TAG);
    await QueueService.enqueueSilentSync(CACHE_TAG);

    res.status(200).json({ success: true, message: 'Coupon updated successfully', data: updatedCoupon });
  } catch (error: any) {
    console.error('Update Coupon Error:', error);
    if (error.code === 'P2002') return res.status(400).json({ error: 'Coupon code already exists' });
    res.status(500).json({ error: 'Failed to update coupon' });
  }
};

// ==========================================
// 4. DELETE COUPON (Safeguarded)
// ==========================================
export const deleteCoupon = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = (req as any).admin?.id as string;

    const existingCoupon = await prisma.coupon.findUnique({ 
      where: { id: id as string },
      include: { _count: { select: { payments: true } } }
    });

    if (!existingCoupon) return res.status(404).json({ error: 'Coupon not found' });

    // SAFEGUARD: Do not delete if it has been used in a transaction, as it breaks financial history.
    if (existingCoupon._count.payments > 0) {
      return res.status(403).json({ 
        error: `Cannot delete coupon because it has been used in ${existingCoupon._count.payments} payment(s). Please deactivate it instead by setting is_active to false.` 
      });
    }

    await prisma.coupon.delete({ where: { id: id as string } });

    // Audit Log
    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId,
        action: 'DELETED_COUPON',
        target_id: id as string,
        details: { code: existingCoupon.code }
      }
    });

    await CacheService.invalidateTag(CACHE_TAG);
    await QueueService.enqueueSilentSync(CACHE_TAG);

    res.status(200).json({ success: true, message: 'Coupon deleted successfully' });
  } catch (error) {
    console.error('Delete Coupon Error:', error);
    res.status(500).json({ error: 'Failed to delete coupon' });
  }
};

// ==========================================
// 5. TOGGLE COUPON STATUS
// ==========================================
export const toggleCouponStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    const adminId = (req as any).admin?.id as string;

    if (is_active === undefined) {
      return res.status(400).json({ error: 'Status (is_active) is required' });
    }

    const coupon = await prisma.coupon.update({
      where: { id: id as string },
      data: { is_active }
    });

    // Audit Log
    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId,
        action: is_active ? 'ACTIVATED_COUPON' : 'DEACTIVATED_COUPON',
        target_id: coupon.id,
        details: { code: coupon.code }
      }
    });

    await CacheService.invalidateTag(CACHE_TAG);
    await QueueService.enqueueSilentSync(CACHE_TAG);

    res.status(200).json({ success: true, message: 'Coupon status updated', data: coupon });
  } catch (error) {
    console.error('Toggle Coupon Status Error:', error);
    res.status(500).json({ error: 'Failed to update coupon status' });
  }
};