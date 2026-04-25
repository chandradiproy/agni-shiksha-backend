// src/routes/admin/category.routes.ts

import { Router } from 'express';
import { requireAdmin } from '../../middlewares/adminAuth';
import {
  createCategory,
  getAllCategories,
  updateCategory,
  deleteCategory,
} from '../../controllers/admin/category.controller';

const router = Router();

// ==========================================
// EXAM CATEGORY ROUTES (Admin CRUD)
// ==========================================
router.post('/', requireAdmin, createCategory);
router.get('/', requireAdmin, getAllCategories);
router.put('/:id', requireAdmin, updateCategory);
router.delete('/:id', requireAdmin, deleteCategory);

export default router;
