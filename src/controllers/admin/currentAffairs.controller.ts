// src/controllers/admin/currentAffairs.controller.ts

import { Request, Response } from 'express';
import prisma from '../../config/db';
import { fetchAndStoreNews } from '../../services/newsService';
import { CacheService } from '../../services/cache.service';
import { broadcastCacheInvalidation } from '../../utils/broadcast';

// 1. Manually trigger the news sync
export const triggerNewsSync = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).admin?.id as string;
    const result = await fetchAndStoreNews();
    if (!result.success) {
      return res.status(500).json({ error: 'Failed to sync news', details: result.error });
    }
    
    // Audit Log
    if (adminId) {
      await prisma.adminAuditLog.create({
        data: { admin_id: adminId, action: 'TRIGGERED_NEWS_SYNC', target_id: adminId }
      });
    }

    // 🔴 CRITICAL: Invalidate the Redis cache immediately and push signal to phones!
    await CacheService.invalidateTag('articles');
    await CacheService.invalidateTag('dashboard_home');
    broadcastCacheInvalidation('articles');

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
    const adminId = (req as any).admin?.id as string;

    const updatedArticle = await prisma.article.update({
      where: { id: id as string },
      data: {
        is_hidden: is_hidden !== undefined ? is_hidden : undefined,
        is_pinned: is_pinned !== undefined ? is_pinned : undefined,
        updated_by: adminId // <-- NEW
      }
    });

    // Audit Log
    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId,
        action: 'UPDATED_ARTICLE_STATUS',
        target_id: updatedArticle.id,
        details: { is_hidden, is_pinned }
      }
    });

    // 🔴 Invalidate cache globally
    await CacheService.invalidateTag('articles');
    await CacheService.invalidateTag('dashboard_home');
    broadcastCacheInvalidation('articles');

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
    const adminId = (req as any).admin?.id as string;

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
        published_at: new Date(),
        created_by: adminId // <-- NEW
      }
    });

    // Audit Log
    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId,
        action: 'CREATED_ARTICLE',
        target_id: article.id,
        details: { title }
      }
    });

    // 🔴 Invalidate cache globally
    await CacheService.invalidateTag('articles');
    await CacheService.invalidateTag('dashboard_home');
    broadcastCacheInvalidation('articles');

    res.status(201).json({ message: 'Custom article created successfully', data: article });
  } catch (error) {
    console.error('Create Custom Article Error:', error);
    res.status(500).json({ error: 'Failed to create custom article' });
  }
};


// 4.5. Edit a Custom Article (Admin Manual Entry Update)
export const editCustomArticle = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, summary, content, source_name, image_url, is_pinned } = req.body;
    const adminId = (req as any).admin?.id as string;

    const existingArticle = await prisma.article.findUnique({ where: { id: id as string } });
    if (!existingArticle) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Only allow full text edits for custom (manually created) articles to prevent over-writing syncs
    if (!existingArticle.is_custom) {
      return res.status(400).json({ error: 'Cannot edit full content of auto-synced articles natively. Only status updates are permitted.' });
    }

    const updatedArticle = await prisma.article.update({
      where: { id: id as string },
      data: {
        title: title || existingArticle.title,
        summary: summary !== undefined ? summary : existingArticle.summary,
        content: content || existingArticle.content,
        source_name: source_name || existingArticle.source_name,
        image_url: image_url !== undefined ? image_url : existingArticle.image_url,
        is_pinned: is_pinned !== undefined ? is_pinned : existingArticle.is_pinned,
        updated_by: adminId
      }
    });

    // Audit Log
    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId,
        action: 'EDITED_ARTICLE',
        target_id: updatedArticle.id,
        details: { title: updatedArticle.title }
      }
    });

    // 🔴 Invalidate cache globally
    await CacheService.invalidateTag('articles');
    await CacheService.invalidateTag('dashboard_home');
    broadcastCacheInvalidation('articles');

    res.status(200).json({ message: 'Custom article updated successfully', data: updatedArticle });
  } catch (error) {
    console.error('Edit Custom Article Error:', error);
    res.status(500).json({ error: 'Failed to edit custom article' });
  }
};

// 5. Delete an Article (Remove spam or mistakes)
export const deleteArticle = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = (req as any).admin?.id as string;
    const article = await prisma.article.findUnique({ where: { id: id as string } });
    const article_title = article?.title;
    const source_url = article?.source_url;
    
    await prisma.article.delete({ where: { id: id as string } });
    
    // Audit Log
    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId,
        action: 'DELETED_ARTICLE',
        target_id: id as string,
        details: {"title": article_title,"url": source_url }
      }
    });

    // 🔴 Invalidate cache globally
    await CacheService.invalidateTag('articles');
    await CacheService.invalidateTag('dashboard_home');
    broadcastCacheInvalidation('articles');

    res.status(200).json({ message: 'Article deleted successfully' });
  } catch (error) {
    console.error('Delete Article Error:', error);
    res.status(500).json({ error: 'Failed to delete article' });
  }
};