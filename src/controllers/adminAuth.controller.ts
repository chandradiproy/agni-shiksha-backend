// src/controllers/adminAuth.controller.ts

import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';
import redisClient from '../config/redis';
import { sendOTP } from '../utils/mailer';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

// Helper to generate Admin JWT
const generateAdminToken = (adminId: string, role: string) => {
  return jwt.sign({ adminId, role }, JWT_SECRET, { expiresIn: '12h' });
};

// STEP 1: Request OTP (Verifies the email exists in admin_users)
export const requestAdminOtp = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    // Ensure this email actually belongs to an Admin
    const adminUser = await prisma.adminUser.findUnique({ where: { email } });
    if (!adminUser) {
      return res.status(403).json({ error: 'Unauthorized. Not an admin account.' });
    }

    if (!adminUser.is_active) {
      return res.status(403).json({ error: 'This admin account has been deactivated.' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save to Redis (5 mins)
    await redisClient.setEx(`admin_otp:${email}`, 300, otp);

    // Send email via Nodemailer
    await sendOTP(email, otp);

    res.status(200).json({ message: 'Admin OTP sent successfully' });
  } catch (error) {
    console.error('Admin Request OTP Error:', error);
    res.status(500).json({ error: 'Failed to request OTP' });
  }
};

// STEP 2: Verify OTP + Validate Password
export const adminLogin = async (req: Request, res: Response) => {
  try {
    const { email, otp, password } = req.body;

    if (!email || !otp || !password) {
      return res.status(400).json({ error: 'Email, OTP, and Password are required' });
    }

    // 1. Verify OTP First (Protects against password brute-forcing)
    const storedOtp = await redisClient.get(`admin_otp:${email}`);
    if (!storedOtp) return res.status(400).json({ error: 'OTP expired or not found' });
    if (storedOtp !== otp) return res.status(400).json({ error: 'Invalid OTP' });

    // 2. Fetch Admin User
    const adminUser = await prisma.adminUser.findUnique({ where: { email } });
    if (!adminUser) return res.status(404).json({ error: 'Admin not found' });

    // 3. Verify Password
    const isPasswordValid = await bcrypt.compare(password, adminUser.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Success! Delete OTP so it cannot be reused
    await redisClient.del(`admin_otp:${email}`);

    // Update last login timestamp
    await prisma.adminUser.update({
      where: { id: adminUser.id },
      data: { last_login: new Date() },
    });

    const token = generateAdminToken(adminUser.id, adminUser.role);

    res.status(200).json({
      message: 'Admin login successful',
      token,
      admin: {
        id: adminUser.id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
      },
    });
  } catch (error) {
    console.error('Admin Login Error:', error);
    res.status(500).json({ error: 'Failed to process admin login' });
  }
};

// DEV ONLY: Helper endpoint to create your first Admin account
// You should remove or comment out this endpoint before going to production!
export const seedFirstAdmin = async (req: Request, res: Response) => {
  try {
    const { email, password, name, role } = req.body;
    if (!email || !password || !name) {
      console.error('Seed Admin Error: Email, Password, and Name are required');
      return res.status(400).json({ error: 'Email, Password, and Name are required' });
    }else{
      console.log('Seeding first admin with email:', email);
    }
    
    const existingAdmin = await prisma.adminUser.findUnique({ where: { email } });
    if (existingAdmin) return res.status(400).json({ error: 'Admin already exists' });

    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(password, salt);

    const newAdmin = await prisma.adminUser.create({
      data: {
        email,
        name,
        password_hash,
        role: role || 'super_admin'
      }
    });

    res.status(201).json({ message: 'Admin created successfully', adminId: newAdmin.id });
  } catch (error) {
    console.error('Seed Admin Error:', error);
    res.status(500).json({ error: 'Failed to seed admin' });
  }
};