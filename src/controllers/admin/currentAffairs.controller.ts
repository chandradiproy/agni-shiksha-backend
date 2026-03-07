// src/controllers/admin/currentAffairs.controller.ts

import { Request, Response } from 'express';
import prisma from '../../config/db';
import { fetchAndStoreNews } from '../../services/newsService';

// 1. Manually trigger the news sync
export const triggerNewsSync = async (req: Request, res: Response) => {
  try {
    const result = await fetchAndStoreNews();
    if (!result.success) {
      return res.status(500).json({ error: 'Failed to sync news', details: result.error });
    }
    res.status(200).json({ message: 'News sync completed successfully', data: result });
  } catch (error) {
    console.error('News Sync Error:', error);
    res.status(500).json({ error: 'Internal server error during sync' });
  }
};

// 2. Get list of articles for Admin to review
export const getAdminArticles = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [articles, totalCount] = await Promise.all([
      prisma.article.findMany({
        skip,
        take: limit,
        orderBy: { published_at: 'desc' }
      }),
      prisma.article.count()
    ]);

    res.status(200).json({
      data: articles,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Get Admin Articles Error:', error);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
};

// 3. Update article status (Hide or Pin)
export const updateArticleStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { is_hidden, is_pinned } = req.body;

    const updatedArticle = await prisma.article.update({
      where: { id: id as string },
      data: {
        is_hidden: is_hidden !== undefined ? is_hidden : undefined,
        is_pinned: is_pinned !== undefined ? is_pinned : undefined
      }
    });

    res.status(200).json({ message: 'Article status updated', article: updatedArticle });
  } catch (error) {
    console.error('Update Article Status Error:', error);
    res.status(500).json({ error: 'Failed to update article status' });
  }
};