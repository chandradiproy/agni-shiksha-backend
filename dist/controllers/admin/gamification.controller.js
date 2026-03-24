"use strict";
// src/controllers/admin/gamification.controller.ts
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
exports.deleteBadge = exports.updateBadge = exports.getBadges = exports.createBadge = exports.deleteQuest = exports.updateQuest = exports.getQuests = exports.createQuest = void 0;
const db_1 = __importDefault(require("../../config/db"));
// ==========================================
// QUEST CONFIGURATION
// ==========================================
const createQuest = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { title, description, xp_reward, target_action, target_count, is_active, } = req.body;
        if (!title ||
            !description ||
            !xp_reward ||
            !target_action ||
            !target_count) {
            return res
                .status(400)
                .json({ error: "All core quest fields are required" });
        }
        const quest = yield db_1.default.questConfig.create({
            data: {
                title,
                description,
                xp_reward: Number(xp_reward),
                target_action,
                target_count: Number(target_count),
                is_active: is_active !== null && is_active !== void 0 ? is_active : true,
            },
        });
        // Log the creation
        const adminId = req.admin.id;
        yield db_1.default.adminAuditLog.create({
            data: {
                admin_id: adminId,
                action: "CREATED_QUEST",
                target_id: quest.id,
                details: { title: quest.title },
            },
        });
        res
            .status(201)
            .json({ message: "Quest created successfully", data: quest });
    }
    catch (error) {
        console.error("Create Quest Error:", error);
        res.status(500).json({ error: "Failed to create quest" });
    }
});
exports.createQuest = createQuest;
const getQuests = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const quests = yield db_1.default.questConfig.findMany({
            orderBy: { created_at: "desc" },
        });
        res.status(200).json({ data: quests });
    }
    catch (error) {
        console.error("Fetch Quests Error:", error);
        res.status(500).json({ error: "Failed to fetch quests" });
    }
});
exports.getQuests = getQuests;
const updateQuest = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const adminId = req.admin.id;
        const updateData = Object.assign({}, req.body);
        // Parse numeric fields if they exist in the update payload
        if (updateData.xp_reward)
            updateData.xp_reward = Number(updateData.xp_reward);
        if (updateData.target_count)
            updateData.target_count = Number(updateData.target_count);
        if (updateData.is_active !== undefined)
            updateData.is_active = Boolean(updateData.is_active);
        const updatedQuest = yield db_1.default.questConfig.update({
            where: { id: id },
            data: updateData,
        });
        // Log the update
        yield db_1.default.adminAuditLog.create({
            data: {
                admin_id: adminId,
                action: "UPDATED_QUEST",
                target_id: id,
                details: { title: updatedQuest.title },
            },
        });
        res
            .status(200)
            .json({ message: "Quest updated successfully", data: updatedQuest });
    }
    catch (error) {
        console.error("Update Quest Error:", error);
        res.status(500).json({ error: "Failed to update quest" });
    }
});
exports.updateQuest = updateQuest;
const deleteQuest = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const adminId = req.admin.id;
        const existingQuest = yield db_1.default.questConfig.findUnique({
            where: { id: id },
        });
        if (!existingQuest)
            return res.status(404).json({ error: "Quest not found" });
        yield db_1.default.questConfig.delete({ where: { id: id } });
        // Log the deletion
        yield db_1.default.adminAuditLog.create({
            data: {
                admin_id: adminId,
                action: "DELETED_QUEST",
                target_id: id,
                details: { title: existingQuest.title },
            },
        });
        res.status(200).json({ message: "Quest deleted successfully" });
    }
    catch (error) {
        console.error("Delete Quest Error:", error);
        res.status(500).json({ error: "Failed to delete quest" });
    }
});
exports.deleteQuest = deleteQuest;
// ==========================================
// BADGE CONFIGURATION
// ==========================================
const createBadge = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { badge_name, description, icon_url, unlock_xp_threshold } = req.body;
        if (!badge_name ||
            !description ||
            !icon_url ||
            unlock_xp_threshold === undefined) {
            return res.status(400).json({ error: "All badge fields are required" });
        }
        const badge = yield db_1.default.badgeConfig.create({
            data: {
                badge_name,
                description,
                icon_url,
                unlock_xp_threshold: Number(unlock_xp_threshold),
            },
        });
        // Log the creation
        const adminId = req.admin.id;
        yield db_1.default.adminAuditLog.create({
            data: {
                admin_id: adminId,
                action: "CREATED_BADGE",
                target_id: badge.id,
                details: { badge_name: badge.badge_name },
            },
        });
        res
            .status(201)
            .json({ message: "Badge created successfully", data: badge });
    }
    catch (error) {
        console.error("Create Badge Error:", error);
        res.status(500).json({ error: "Failed to create badge" });
    }
});
exports.createBadge = createBadge;
const getBadges = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const badges = yield db_1.default.badgeConfig.findMany({
            orderBy: { unlock_xp_threshold: "asc" }, // Show lowest XP requirement first
        });
        res.status(200).json({ data: badges });
    }
    catch (error) {
        console.error("Fetch Badges Error:", error);
        res.status(500).json({ error: "Failed to fetch badges" });
    }
});
exports.getBadges = getBadges;
const updateBadge = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const adminId = req.admin.id;
        const updateData = Object.assign({}, req.body);
        if (updateData.unlock_xp_threshold !== undefined) {
            updateData.unlock_xp_threshold = Number(updateData.unlock_xp_threshold);
        }
        const updatedBadge = yield db_1.default.badgeConfig.update({
            where: { id: id },
            data: updateData,
        });
        // Log the update
        yield db_1.default.adminAuditLog.create({
            data: {
                admin_id: adminId,
                action: "UPDATED_BADGE",
                target_id: id,
                details: { badge_name: updatedBadge.badge_name },
            },
        });
        res
            .status(200)
            .json({ message: "Badge updated successfully", data: updatedBadge });
    }
    catch (error) {
        console.error("Update Badge Error:", error);
        res.status(500).json({ error: "Failed to update badge" });
    }
});
exports.updateBadge = updateBadge;
const deleteBadge = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const adminId = req.admin.id;
        const existingBadge = yield db_1.default.badgeConfig.findUnique({
            where: { id: id },
        });
        if (!existingBadge)
            return res.status(404).json({ error: "Badge not found" });
        yield db_1.default.badgeConfig.delete({ where: { id: id } });
        // Log the deletion
        yield db_1.default.adminAuditLog.create({
            data: {
                admin_id: adminId,
                action: "DELETED_BADGE",
                target_id: id,
                details: { badge_name: existingBadge.badge_name },
            },
        });
        res.status(200).json({ message: "Badge deleted successfully" });
    }
    catch (error) {
        console.error("Delete Badge Error:", error);
        res.status(500).json({ error: "Failed to delete badge" });
    }
});
exports.deleteBadge = deleteBadge;
