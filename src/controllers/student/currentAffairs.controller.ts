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
    const skip = (page - 1) * limit;

    // SCALABILITY: Aggressively cache the first page since 95% of traffic hits Page 1
    const cacheKey = `articles_feed:page:${page}:limit:${limit}`;
    
    if (page === 1) {
      const cachedPage = await redisClient.get(cacheKey);
      if (cachedPage) {
        return res.status(200).json(JSON.parse(cachedPage));
      }
    }

    const [articles, totalCount] = await Promise.all([
      prisma.article.findMany({
        where: { is_hidden: false },
        skip,
        take: limit,
        // Pinned articles float to the top, then sort by publish date
        orderBy: [{ is_pinned: 'desc' }, { published_at: 'desc' }],
        select: {
          id: true,
          title: true,
          summary: true,
          image_url: true,
          source_name: true,
          published_at: true,
          is_pinned: true,
          is_custom: true,
          content:true,
          // Exclude 'content' to keep the feed payload extremely lightweight
        }
      }),
      prisma.article.count({ where: { is_hidden: false } })
    ]);

    const responseData = {
      success: true,
      data: articles,
      pagination: { total: totalCount, page, limit, totalPages: Math.ceil(totalCount / limit) }
    };

    // Cache the first page for 15 minutes (articles don't update every second)
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