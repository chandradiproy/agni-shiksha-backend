// src/controllers/student/utility.controller.ts

import { Request, Response } from 'express';
import prisma from '../../config/db';
import { CacheService } from '../../services/cache.service';

const BOOKMARK_CACHE_TAG = 'bookmarks';

// ==========================================
// 1. TOGGLE BOOKMARK (Add / Remove)
// ==========================================
export const toggleBookmark = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id as string;
    const { item_type, item_id } = req.body; // e.g., 'ARTICLE', '123-uuid'

    if (!item_type || !item_id) {
      return res.status(400).json({ error: 'Item type and ID are required' });
    }

    const validTypes = ['ARTICLE', 'TEST', 'STUDY_MATERIAL'];
    if (!validTypes.includes(item_type)) {
      return res.status(400).json({ error: `Invalid item_type. Must be one of: ${validTypes.join(', ')}` });
    }

    // Check if bookmark already exists
    const existingBookmark = await prisma.bookmark.findUnique({
      where: {
        user_id_item_type_item_id: {
          user_id: userId,
          item_type,
          item_id
        }
      }
    });

    if (existingBookmark) {
      // Un-bookmark (Delete)
      await prisma.bookmark.delete({ where: { id: existingBookmark.id } });
      // Invalidate cache so the bookmark list is fresh on next fetch
      await CacheService.invalidateTag(BOOKMARK_CACHE_TAG);
      return res.status(200).json({ success: true, message: 'Bookmark removed', action: 'removed' });
    } else {
      // Add Bookmark
      const newBookmark = await prisma.bookmark.create({
        data: { user_id: userId, item_type, item_id }
      });
      await CacheService.invalidateTag(BOOKMARK_CACHE_TAG);
      return res.status(201).json({ success: true, message: 'Bookmarked successfully', action: 'added', data: newBookmark });
    }
  } catch (error) {
    console.error('Toggle Bookmark Error:', error);
    res.status(500).json({ error: 'Failed to toggle bookmark' });
  }
};

// ==========================================
// 2. GET ALL BOOKMARKS (Hydrated with item data)
// ==========================================
export const getBookmarks = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id as string;
    const itemType = req.query.type as string; // Optional filter (e.g., ?type=ARTICLE)
    const bypassCache = req.headers['x-bypass-cache'] === 'true';

    // Check cache first
    const cacheKey = `list:${itemType || 'ALL'}`;
    if (!bypassCache) {
      const cached = await CacheService.get<any>(BOOKMARK_CACHE_TAG + ':' + cacheKey, userId);
      if (cached) {
        return res.status(200).json({ success: true, data: cached, cached: true });
      }
    }

    const whereClause: any = { user_id: userId };
    if (itemType) whereClause.item_type = itemType;

    const bookmarks = await prisma.bookmark.findMany({
      where: whereClause,
      orderBy: { created_at: 'desc' }
    });

    if (bookmarks.length === 0) {
      await CacheService.set(BOOKMARK_CACHE_TAG + ':' + cacheKey, userId, [], 1800);
      return res.status(200).json({ success: true, data: [] });
    }

    // Group IDs by type for batch queries
    const articleIds: string[] = [];
    const testIds: string[] = [];

    for (const b of bookmarks) {
      if (b.item_type === 'ARTICLE') articleIds.push(b.item_id);
      else if (b.item_type === 'TEST') testIds.push(b.item_id);
    }

    // Batch-fetch related items
    const [articles, tests] = await Promise.all([
      articleIds.length > 0
        ? prisma.article.findMany({
            where: { id: { in: articleIds } },
            select: {
              id: true, title: true, summary: true, category: true,
              source_url: true, source_name: true, image_url: true,
              is_custom: true, published_at: true
            }
          })
        : [],
      testIds.length > 0
        ? prisma.testSeries.findMany({
            where: { id: { in: testIds } },
            select: {
              id: true, title: true, description: true,
              total_questions: true, duration_minutes: true,
              difficulty: true, type: true,
              exam: { select: { name: true, category: true } }
            }
          })
        : [],
    ]);

    // Build lookup maps
    const articleMap = new Map(articles.map(a => [a.id, a]));
    const testMap = new Map(tests.map(t => [t.id, t]));

    // Hydrate bookmarks
    const hydrated = bookmarks
      .map(b => {
        let item: any = null;
        if (b.item_type === 'ARTICLE') {
          const a = articleMap.get(b.item_id);
          if (!a) return null; // Item was deleted
          item = {
            title: a.title, summary: a.summary, category: a.category,
            source_url: a.source_url, source_name: a.source_name,
            image_url: a.image_url, is_custom: a.is_custom, published_at: a.published_at
          };
        } else if (b.item_type === 'TEST') {
          const t = testMap.get(b.item_id);
          if (!t) return null; // Item was deleted
          item = {
            title: t.title, description: t.description,
            total_questions: t.total_questions, duration_minutes: t.duration_minutes,
            difficulty: t.difficulty, is_free: t.type === 'FREE',
            exam_name: t.exam?.name ?? null, category: t.exam?.category ?? null
          };
        }

        return {
          id: b.id,
          item_type: b.item_type,
          item_id: b.item_id,
          created_at: b.created_at,
          item
        };
      })
      .filter(Boolean); // Remove any null entries (deleted items)

    // Cache for 30 minutes
    await CacheService.set(BOOKMARK_CACHE_TAG + ':' + cacheKey, userId, hydrated, 1800);

    res.status(200).json({ success: true, data: hydrated });
  } catch (error) {
    console.error('Get Bookmarks Error:', error);
    res.status(500).json({ error: 'Failed to fetch bookmarks' });
  }
};

// ==========================================
// 2b. BULK CHECK BOOKMARKS (Which IDs are bookmarked?)
// ==========================================
export const checkBookmarks = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id as string;
    const itemIdsParam = req.query.item_ids as string;

    if (!itemIdsParam) {
      return res.status(400).json({ error: 'item_ids query parameter is required (comma-separated UUIDs)' });
    }

    const itemIds = itemIdsParam.split(',').map(id => id.trim()).filter(Boolean);

    if (itemIds.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    // Cap at 100 IDs per request to prevent abuse
    if (itemIds.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 item_ids allowed per request' });
    }

    const bookmarks = await prisma.bookmark.findMany({
      where: {
        user_id: userId,
        item_id: { in: itemIds }
      },
      select: { item_id: true }
    });

    const bookmarkedIds = bookmarks.map(b => b.item_id);

    res.status(200).json({ success: true, data: bookmarkedIds });
  } catch (error) {
    console.error('Check Bookmarks Error:', error);
    res.status(500).json({ error: 'Failed to check bookmarks' });
  }
};

// ==========================================
// 3. CREATE A NOTE
// ==========================================
export const createNote = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id as string;
    const { title, content } = req.body;

    if (!content) return res.status(400).json({ error: 'Note content is required' });

    const note = await prisma.note.create({
      data: { user_id: userId, title, content }
    });

    res.status(201).json({ success: true, message: 'Note created', data: note });
  } catch (error) {
    console.error('Create Note Error:', error);
    res.status(500).json({ error: 'Failed to create note' });
  }
};

// ==========================================
// 4. GET ALL NOTES
// ==========================================
export const getNotes = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id as string;

    const notes = await prisma.note.findMany({
      where: { user_id: userId },
      orderBy: { updated_at: 'desc' }
    });

    res.status(200).json({ success: true, data: notes });
  } catch (error) {
    console.error('Get Notes Error:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
};

// ==========================================
// 5. UPDATE A NOTE
// ==========================================
export const updateNote = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id as string;
    const { id } = req.params;
    const { title, content } = req.body;

    // Ensure the note belongs to the user
    const existingNote = await prisma.note.findFirst({ where: { id: id as string, user_id: userId } });
    if (!existingNote) return res.status(404).json({ error: 'Note not found' });

    const updatedNote = await prisma.note.update({
      where: { id: id as string },
      data: { title, content }
    });

    res.status(200).json({ success: true, message: 'Note updated', data: updatedNote });
  } catch (error) {
    console.error('Update Note Error:', error);
    res.status(500).json({ error: 'Failed to update note' });
  }
};

// ==========================================
// 6. DELETE A NOTE
// ==========================================
export const deleteNote = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id as string;
    const { id } = req.params;

    const existingNote = await prisma.note.findFirst({ where: { id: id as string, user_id: userId } });
    if (!existingNote) return res.status(404).json({ error: 'Note not found' });

    await prisma.note.delete({ where: { id: id as string } });

    res.status(200).json({ success: true, message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Delete Note Error:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  }
};