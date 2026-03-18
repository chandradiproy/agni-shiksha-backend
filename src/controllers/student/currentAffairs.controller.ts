// src/controllers/student/currentAffairs.controller.ts

import { Request, Response } from 'express';
import prisma from '../../config/db';
import redisClient from '../../config/redis';

// ==========================================
// 1. GET PAGINATED NEWS FEED
// ==========================================
export const getArticles = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const category = req.query.category as string; // NEW: Capture the category
    const skip = (page - 1) * limit;

    const whereClause: any = { is_hidden: false };
    if (category) {
      whereClause.category = { equals: category, mode: 'insensitive' };
    }

    // Update cache key to include category so we don't serve "Sports" news to an "Economy" request
    const cacheKey = `articles_feed:cat:${category || 'all'}:page:${page}:limit:${limit}`;
    
    if (page === 1) {
      const cachedPage = await redisClient.get(cacheKey);
      if (cachedPage) {
        return res.status(200).json(JSON.parse(cachedPage));
      }
    }

    const [articles, totalCount] = await Promise.all([
      prisma.article.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: [{ is_pinned: 'desc' }, { published_at: 'desc' }],
        select: {
          id: true,
          title: true,
          summary: true,
          image_url: true,
          source_name: true,
          category: true, // Return category to UI
          published_at: true,
          is_pinned: true,
        }
      }),
      prisma.article.count({ where: whereClause })
    ]);

    const responseData = {
      success: true,
      data: articles,
      pagination: { total: totalCount, page, limit, totalPages: Math.ceil(totalCount / limit) }
    };

    if (page === 1) {
      await redisClient.setEx(cacheKey, 900, JSON.stringify(responseData));
    }

    res.status(200).json(responseData);

  } catch (error) {
    console.error('Get Articles Error:', error);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
};

// ==========================================
// 2. GET FULL ARTICLE DETAILS
// ==========================================
export const getArticleDetails = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Cache individual articles heavily (they are rarely edited after publication)
    const cacheKey = `article_detail:${id}`;
    const cachedArticle = await redisClient.get(cacheKey);

    if (cachedArticle) {
      return res.status(200).json({ success: true, data: JSON.parse(cachedArticle) });
    }

    const article = await prisma.article.findUnique({
      where: { id: id as string, is_hidden: false }
    });

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    await redisClient.setEx(cacheKey, 3600, JSON.stringify(article));

    res.status(200).json({
      success: true,
      data: article
    });

  } catch (error) {
    console.error('Get Article Details Error:', error);
    res.status(500).json({ error: 'Failed to fetch article details' });
  }
};