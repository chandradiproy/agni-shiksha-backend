// src/controllers/admin/category.controller.ts

import { Request, Response } from 'express';
import prisma from '../../config/db';
import { CacheService } from '../../services/cache.service';

// ==========================================
// 1. CREATE CATEGORY
// ==========================================
export const createCategory = async (req: Request, res: Response) => {
  try {
    const { name, slug, icon_url } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ error: 'name and slug are required' });
    }

    const existing = await prisma.examCategory.findFirst({
      where: { OR: [{ name }, { slug }] },
    });

    if (existing) {
      return res.status(409).json({ error: 'A category with this name or slug already exists' });
    }

    const category = await prisma.examCategory.create({
      data: { name, slug, icon_url: icon_url || null },
    });

    // Invalidate student-facing category cache
    await CacheService.invalidateTag('categories');

    res.status(201).json({ success: true, data: category });
  } catch (error) {
    console.error('Create Category Error:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
};

// ==========================================
// 2. GET ALL CATEGORIES (Admin — includes inactive)
// ==========================================
export const getAllCategories = async (req: Request, res: Response) => {
  try {
    const categories = await prisma.examCategory.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        _count: { select: { test_series: true } },
      },
    });

    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    console.error('Get All Categories Error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
};

// ==========================================
// 3. UPDATE CATEGORY
// ==========================================
export const updateCategory = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name, slug, icon_url, is_active } = req.body;

    const category = await prisma.examCategory.findUnique({ where: { id } });
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const updated = await prisma.examCategory.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(slug !== undefined && { slug }),
        ...(icon_url !== undefined && { icon_url }),
        ...(is_active !== undefined && { is_active }),
      },
    });

    await CacheService.invalidateTag('categories');

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error('Update Category Error:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
};

// ==========================================
// 4. DELETE CATEGORY
// ==========================================
export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const category = await prisma.examCategory.findUnique({
      where: { id },
      include: { _count: { select: { test_series: true } } },
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    if ((category as any)._count.test_series > 0) {
      return res.status(400).json({
        error: `Cannot delete category "${category.name}" because it has ${(category as any)._count.test_series} test series assigned. Reassign or remove them first.`,
      });
    }

    await prisma.examCategory.delete({ where: { id } });
    await CacheService.invalidateTag('categories');

    res.status(200).json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Delete Category Error:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
};
