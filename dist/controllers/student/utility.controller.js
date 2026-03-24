"use strict";
// src/controllers/student/utility.controller.ts
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteNote = exports.updateNote = exports.getNotes = exports.createNote = exports.getBookmarks = exports.toggleBookmark = void 0;
const db_1 = __importDefault(require("../../config/db"));
// ==========================================
// 1. TOGGLE BOOKMARK (Add / Remove)
// ==========================================
const toggleBookmark = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const { item_type, item_id } = req.body; // e.g., 'ARTICLE', '123-uuid'
        if (!item_type || !item_id) {
            return res.status(400).json({ error: 'Item type and ID are required' });
        }
        // Check if bookmark already exists
        const existingBookmark = yield db_1.default.bookmark.findUnique({
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
            yield db_1.default.bookmark.delete({ where: { id: existingBookmark.id } });
            return res.status(200).json({ success: true, message: 'Bookmark removed', action: 'removed' });
        }
        else {
            // Add Bookmark
            const newBookmark = yield db_1.default.bookmark.create({
                data: { user_id: userId, item_type, item_id }
            });
            return res.status(201).json({ success: true, message: 'Bookmarked successfully', action: 'added', data: newBookmark });
        }
    }
    catch (error) {
        console.error('Toggle Bookmark Error:', error);
        res.status(500).json({ error: 'Failed to toggle bookmark' });
    }
});
exports.toggleBookmark = toggleBookmark;
// ==========================================
// 2. GET ALL BOOKMARKS (Filtered by Type)
// ==========================================
const getBookmarks = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const itemType = req.query.type; // Optional filter (e.g., ?type=ARTICLE)
        const whereClause = { user_id: userId };
        if (itemType)
            whereClause.item_type = itemType;
        const bookmarks = yield db_1.default.bookmark.findMany({
            where: whereClause,
            orderBy: { created_at: 'desc' }
        });
        res.status(200).json({ success: true, data: bookmarks });
    }
    catch (error) {
        console.error('Get Bookmarks Error:', error);
        res.status(500).json({ error: 'Failed to fetch bookmarks' });
    }
});
exports.getBookmarks = getBookmarks;
// ==========================================
// 3. CREATE A NOTE
// ==========================================
const createNote = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const { title, content } = req.body;
        if (!content)
            return res.status(400).json({ error: 'Note content is required' });
        const note = yield db_1.default.note.create({
            data: { user_id: userId, title, content }
        });
        res.status(201).json({ success: true, message: 'Note created', data: note });
    }
    catch (error) {
        console.error('Create Note Error:', error);
        res.status(500).json({ error: 'Failed to create note' });
    }
});
exports.createNote = createNote;
// ==========================================
// 4. GET ALL NOTES
// ==========================================
const getNotes = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const notes = yield db_1.default.note.findMany({
            where: { user_id: userId },
            orderBy: { updated_at: 'desc' }
        });
        res.status(200).json({ success: true, data: notes });
    }
    catch (error) {
        console.error('Get Notes Error:', error);
        res.status(500).json({ error: 'Failed to fetch notes' });
    }
});
exports.getNotes = getNotes;
// ==========================================
// 5. UPDATE A NOTE
// ==========================================
const updateNote = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { title, content } = req.body;
        // Ensure the note belongs to the user
        const existingNote = yield db_1.default.note.findFirst({ where: { id: id, user_id: userId } });
        if (!existingNote)
            return res.status(404).json({ error: 'Note not found' });
        const updatedNote = yield db_1.default.note.update({
            where: { id: id },
            data: { title, content }
        });
        res.status(200).json({ success: true, message: 'Note updated', data: updatedNote });
    }
    catch (error) {
        console.error('Update Note Error:', error);
        res.status(500).json({ error: 'Failed to update note' });
    }
});
exports.updateNote = updateNote;
// ==========================================
// 6. DELETE A NOTE
// ==========================================
const deleteNote = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const existingNote = yield db_1.default.note.findFirst({ where: { id: id, user_id: userId } });
        if (!existingNote)
            return res.status(404).json({ error: 'Note not found' });
        yield db_1.default.note.delete({ where: { id: id } });
        res.status(200).json({ success: true, message: 'Note deleted successfully' });
    }
    catch (error) {
        console.error('Delete Note Error:', error);
        res.status(500).json({ error: 'Failed to delete note' });
    }
});
exports.deleteNote = deleteNote;
