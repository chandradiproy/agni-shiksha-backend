// src/controllers/student/category.controller.ts

import { Request, Response } from 'express';
import prisma from '../../config/db';
import { CacheService } from '../../services/cache.service';

// ==========================================
// 1. GET ALL ACTIVE EXAM CATEGORIES
// ==========================================
export const getAllCategories = async (req: Request, res: Response) => {
  try {
    const cacheScope = 'all_active';
    const cached = await CacheService.get<any>('categories', cacheScope);

    if (cached) {
      return res.status(200).json(cached);
    }

    const categories = await prisma.examCategory.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        icon_url: true,
      },
    });

    const responsePayload = {
      success: true,
      data: categories,
    };

    // Cache for 10 minutes — categories rarely change
    await CacheService.set('categories', cacheScope, responsePayload, 600);

    res.status(200).json(responsePayload);
  } catch (error) {
    console.error('Get Categories Error:', error);
    res.status(500).json({ error: 'Failed to fetch exam categories' });
  }
};
