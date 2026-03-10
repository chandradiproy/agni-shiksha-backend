// src/controllers/admin/gamification.controller.ts

import { Request, Response } from "express";
import prisma from "../../config/db";

// ==========================================
// QUEST CONFIGURATION
// ==========================================

export const createQuest = async (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      xp_reward,
      target_action,
      target_count,
      is_active,
    } = req.body;

    if (
      !title ||
      !description ||
      !xp_reward ||
      !target_action ||
      !target_count
    ) {
      return res
        .status(400)
        .json({ error: "All core quest fields are required" });
    }

    const quest = await prisma.questConfig.create({
      data: {
        title,
        description,
        xp_reward: Number(xp_reward),
        target_action,
        target_count: Number(target_count),
        is_active: is_active ?? true,
      },
    });
    // Log the creation
    const adminId = (req as any).admin.id as string;
    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId,
        action: "CREATED_QUEST",
        target_id: quest.id as string,
        details: { title: quest.title },
      },
    });

    res
      .status(201)
      .json({ message: "Quest created successfully", data: quest });
  } catch (error) {
    console.error("Create Quest Error:", error);
    res.status(500).json({ error: "Failed to create quest" });
  }
};

export const getQuests = async (req: Request, res: Response) => {
  try {
    const quests = await prisma.questConfig.findMany({
      orderBy: { created_at: "desc" },
    });

    res.status(200).json({ data: quests });
  } catch (error) {
    console.error("Fetch Quests Error:", error);
    res.status(500).json({ error: "Failed to fetch quests" });
  }
};

export const updateQuest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = (req as any).admin.id as string;
    const updateData = { ...req.body };

    // Parse numeric fields if they exist in the update payload
    if (updateData.xp_reward)
      updateData.xp_reward = Number(updateData.xp_reward);
    if (updateData.target_count)
      updateData.target_count = Number(updateData.target_count);
    if (updateData.is_active !== undefined)
      updateData.is_active = Boolean(updateData.is_active);

    const updatedQuest = await prisma.questConfig.update({
      where: { id: id as string },
      data: updateData,
    });

    // Log the update
    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId,
        action: "UPDATED_QUEST",
        target_id: id as string,
        details: { title: updatedQuest.title },
      },
    });

    res
      .status(200)
      .json({ message: "Quest updated successfully", data: updatedQuest });
  } catch (error) {
    console.error("Update Quest Error:", error);
    res.status(500).json({ error: "Failed to update quest" });
  }
};

export const deleteQuest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = (req as any).admin.id as string;

    const existingQuest = await prisma.questConfig.findUnique({
      where: { id: id as string },
    });
    if (!existingQuest)
      return res.status(404).json({ error: "Quest not found" });

    await prisma.questConfig.delete({ where: { id: id as string } });

    // Log the deletion
    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId,
        action: "DELETED_QUEST",
        target_id: id as string,
        details: { title: existingQuest.title },
      },
    });

    res.status(200).json({ message: "Quest deleted successfully" });
  } catch (error) {
    console.error("Delete Quest Error:", error);
    res.status(500).json({ error: "Failed to delete quest" });
  }
};

// ==========================================
// BADGE CONFIGURATION
// ==========================================

export const createBadge = async (req: Request, res: Response) => {
  try {
    const { badge_name, description, icon_url, unlock_xp_threshold } = req.body;

    if (
      !badge_name ||
      !description ||
      !icon_url ||
      unlock_xp_threshold === undefined
    ) {
      return res.status(400).json({ error: "All badge fields are required" });
    }

    const badge = await prisma.badgeConfig.create({
      data: {
        badge_name,
        description,
        icon_url,
        unlock_xp_threshold: Number(unlock_xp_threshold),
      },
    });

    // Log the creation
    const adminId = (req as any).admin.id as string;
    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId,
        action: "CREATED_BADGE",
        target_id: badge.id as string,
        details: { badge_name: badge.badge_name },
      },
    });

    res
      .status(201)
      .json({ message: "Badge created successfully", data: badge });
  } catch (error) {
    console.error("Create Badge Error:", error);
    res.status(500).json({ error: "Failed to create badge" });
  }
};

export const getBadges = async (req: Request, res: Response) => {
  try {
    const badges = await prisma.badgeConfig.findMany({
      orderBy: { unlock_xp_threshold: "asc" }, // Show lowest XP requirement first
    });

    res.status(200).json({ data: badges });
  } catch (error) {
    console.error("Fetch Badges Error:", error);
    res.status(500).json({ error: "Failed to fetch badges" });
  }
};

export const updateBadge = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = (req as any).admin.id as string;
    const updateData = { ...req.body };

    if (updateData.unlock_xp_threshold !== undefined) {
      updateData.unlock_xp_threshold = Number(updateData.unlock_xp_threshold);
    }

    const updatedBadge = await prisma.badgeConfig.update({
      where: { id: id as string },
      data: updateData,
    });

    // Log the update
    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId,
        action: "UPDATED_BADGE",
        target_id: id as string,
        details: { badge_name: updatedBadge.badge_name },
      },
    });

    res
      .status(200)
      .json({ message: "Badge updated successfully", data: updatedBadge });
  } catch (error) {
    console.error("Update Badge Error:", error);
    res.status(500).json({ error: "Failed to update badge" });
  }
};

export const deleteBadge = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = (req as any).admin.id as string;

    const existingBadge = await prisma.badgeConfig.findUnique({
      where: { id: id as string },
    });
    if (!existingBadge)
      return res.status(404).json({ error: "Badge not found" });

    await prisma.badgeConfig.delete({ where: { id: id as string } });

    // Log the deletion
    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId,
        action: "DELETED_BADGE",
        target_id: id as string,
        details: { badge_name: existingBadge.badge_name },
      },
    });

    res.status(200).json({ message: "Badge deleted successfully" });
  } catch (error) {
    console.error("Delete Badge Error:", error);
    res.status(500).json({ error: "Failed to delete badge" });
  }
};
