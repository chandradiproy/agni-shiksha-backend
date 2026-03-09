// src/controllers/student/currentAffairs.controller.ts

import { Request, Response } from 'express';
import prisma from '../../config/db';

export const getStudentArticles = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [articles, totalCount] = await Promise.all([
      prisma.article.findMany({
        where: { 
          is_hidden: false // CRITICAL: Never send hidden articles to the mobile app
        },
        skip,
        take: limit,
        orderBy: [
          { is_pinned: 'desc' }, // Pinned articles show up first
          { published_at: 'desc' } // Then sort by newest
        ],
        select: {
          id: true,
          title: true,
          summary: true,
          source_name: true,
          source_url: true,
          image_url: true,
          published_at: true,
          is_pinned: true,
          is_custom: true // <-- So the app can show an "Agni Shiksha Exclusive" badge!
          // We intentionally omit admin fields like 'is_hidden' and 'updated_at'
        }
      }),
      prisma.article.count({ where: { is_hidden: false } })
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
    console.error('Get Student Articles Error:', error);
    res.status(500).json({ error: 'Failed to fetch current affairs' });
  }
};

// NEW: Fetch full article details including the heavy Body Content
export const getStudentArticleById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const article = await prisma.article.findUnique({
      where: { id: id as string },
      select: {
        id: true,
        title: true,
        summary: true,
        content: true, // <-- The heavy rich-text/Markdown payload!
        source_name: true,
        image_url: true,
        published_at: true,
        is_custom: true
      }
    });

    if (!article) return res.status(404).json({ error: 'Article not found' });

    res.status(200).json({ data: article });
  } catch (error) {
    console.error('Get Article Detail Error:', error);
    res.status(500).json({ error: 'Failed to fetch article details' });
  }
};