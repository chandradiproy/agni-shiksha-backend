// src/controllers/admin/plan.controller.ts

import { Request, Response } from 'express';
import prisma from '../../config/db';

import { CacheService } from '../../services/cache.service';
import { QueueService } from '../../services/queue.service';
const CACHE_TAG = 'premium';

// ==========================================
// 1. CREATE A NEW PREMIUM PLAN
// ==========================================
export const createPlan = async (req: Request, res: Response) => {
  try {
    const { name, slug, monthly_price_paise, annual_price_paise, features, is_active, display_order } = req.body;
    const adminId = (req as any).admin.id as string;

    if (!name || !slug || monthly_price_paise === undefined || annual_price_paise === undefined || !features) {
      return res.status(400).json({ error: 'Missing required fields: name, slug, prices, or features.' });
    }

    const newPlan = await prisma.plan.create({
      data: {
        name,
        slug,
        monthly_price_paise: Number(monthly_price_paise),
        annual_price_paise: Number(annual_price_paise),
        features, // Handled as JSON
        is_active: is_active ?? true,
        display_order: Number(display_order) || 1
      }
    });

    // Audit Log
    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId,
        action: 'CREATED_PLAN',
        target_id: newPlan.id,
        details: { plan_name: name }
      }
    });
    await CacheService.invalidateTag(CACHE_TAG);
    await QueueService.enqueueSilentSync(CACHE_TAG);

    res.status(201).json({ success: true, message: 'Plan created successfully', data: newPlan });
  } catch (error: any) {
    console.error('Create Plan Error:', error);
    if (error.code === 'P2002') return res.status(400).json({ error: 'Plan slug must be unique' });
    res.status(500).json({ error: 'Failed to create plan' });
  }
};

// ==========================================
// 2. GET ALL PLANS (Including Inactive)
// ==========================================
export const getAllPlans = async (req: Request, res: Response) => {
  try {
    const plans = await prisma.plan.findMany({
      orderBy: { display_order: 'asc' },
      include: {
        _count: {
          select: { subscriptions: true } // Let admin see how many users bought this plan
        }
      }
    });

    res.status(200).json({ success: true, data: plans });
  } catch (error) {
    console.error('Fetch Plans Error:', error);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
};

// ==========================================
// 3. UPDATE A PLAN
// ==========================================
export const updatePlan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = (req as any).admin.id as string;
    const updateData = req.body;

    const existingPlan = await prisma.plan.findUnique({ where: { id: id as string } });
    if (!existingPlan) return res.status(404).json({ error: 'Plan not found' });

    // Format numbers if they exist in the payload
    if (updateData.monthly_price_paise !== undefined) updateData.monthly_price_paise = Number(updateData.monthly_price_paise);
    if (updateData.annual_price_paise !== undefined) updateData.annual_price_paise = Number(updateData.annual_price_paise);
    if (updateData.display_order !== undefined) updateData.display_order = Number(updateData.display_order);

    const updatedPlan = await prisma.plan.update({
      where: { id: id as string },
      data: updateData
    });

    // Audit Log
    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId,
        action: 'UPDATED_PLAN',
        target_id: id as string,
        details: { fields_updated: Object.keys(updateData) }
      }
    });

    await CacheService.invalidateTag(CACHE_TAG);
    await QueueService.enqueueSilentSync(CACHE_TAG);

    res.status(200).json({ success: true, message: 'Plan updated successfully', data: updatedPlan });
  } catch (error) {
    console.error('Update Plan Error:', error);
    res.status(500).json({ error: 'Failed to update plan' });
  }
};

// ==========================================
// 4. DELETE A PLAN (Safeguarded)
// ==========================================
export const deletePlan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = (req as any).admin.id as string;

    // 1. Fetch existing plan and count tied subscriptions/payments
    const existingPlan = await prisma.plan.findUnique({ 
      where: { id: id as string },
      include: {
        _count: {
          select: { subscriptions: true, payments: true }
        }
      }
    });

    if (!existingPlan) return res.status(404).json({ error: 'Plan not found' });

    // 2. VALIDATION LOCK: Do not allow hard-deletion of plans that have financial records attached!
    if (existingPlan._count.subscriptions > 0 || existingPlan._count.payments > 0) {
      return res.status(403).json({ 
        error: `Cannot delete this plan because ${existingPlan._count.subscriptions} subscriptions and ${existingPlan._count.payments} payments are tied to it. Please use the update API to set "is_active": false instead.` 
      });
    }

    // 3. Perform hard deletion safely
    await prisma.plan.delete({
      where: { id: id as string }
    });

    // Audit Log
    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId,
        action: 'DELETED_PLAN',
        target_id: id as string,
        details: { plan_name: existingPlan.name }
      }
    });

    await CacheService.invalidateTag(CACHE_TAG);
    await QueueService.enqueueSilentSync(CACHE_TAG);

    res.status(200).json({ success: true, message: 'Plan deleted successfully' });
  } catch (error) {
    console.error('Delete Plan Error:', error);
    res.status(500).json({ error: 'Failed to delete plan' });
  }
};