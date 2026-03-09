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

// 4. Create a Custom Article (Admin Manual Entry)
export const createCustomArticle = async (req: Request, res: Response) => {
  try {
    const { title, summary, content, source_name, image_url, is_pinned } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and full content are required for custom articles' });
    }

    const article = await prisma.article.create({
      data: {
        title,
        summary: summary || content.substring(0, 150) + '...', // Auto-generate summary if empty
        content,
        source_name: source_name || 'Agni Shiksha Official',
        source_url: null, // Null safely indicates it is natively hosted inside the app!
        image_url,
        is_custom: true,
        is_pinned: is_pinned || false,
        published_at: new Date()
      }
    });

    res.status(201).json({ message: 'Custom article created successfully', data: article });
  } catch (error) {
    console.error('Create Custom Article Error:', error);
    res.status(500).json({ error: 'Failed to create custom article' });
  }
};

// 5. Delete an Article (Remove spam or mistakes)
export const deleteArticle = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.article.delete({ where: { id: id as string } });
    res.status(200).json({ message: 'Article deleted successfully' });
  } catch (error) {
    console.error('Delete Article Error:', error);
    res.status(500).json({ error: 'Failed to delete article' });
  }
};