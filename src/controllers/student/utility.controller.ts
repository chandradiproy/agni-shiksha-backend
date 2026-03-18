// src/controllers/student/utility.controller.ts

import { Request, Response } from 'express';
import prisma from '../../config/db';

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
      return res.status(200).json({ success: true, message: 'Bookmark removed', action: 'removed' });
    } else {
      // Add Bookmark
      const newBookmark = await prisma.bookmark.create({
        data: { user_id: userId, item_type, item_id }
      });
      return res.status(201).json({ success: true, message: 'Bookmarked successfully', action: 'added', data: newBookmark });
    }
  } catch (error) {
    console.error('Toggle Bookmark Error:', error);
    res.status(500).json({ error: 'Failed to toggle bookmark' });
  }
};

// ==========================================
// 2. GET ALL BOOKMARKS (Filtered by Type)
// ==========================================
export const getBookmarks = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id as string;
    const itemType = req.query.type as string; // Optional filter (e.g., ?type=ARTICLE)

    const whereClause: any = { user_id: userId };
    if (itemType) whereClause.item_type = itemType;

    const bookmarks = await prisma.bookmark.findMany({
      where: whereClause,
      orderBy: { created_at: 'desc' }
    });

    res.status(200).json({ success: true, data: bookmarks });
  } catch (error) {
    console.error('Get Bookmarks Error:', error);
    res.status(500).json({ error: 'Failed to fetch bookmarks' });
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