// src/controllers/auth.controller.ts

import { Request, Response } from 'express';
import prisma from '../config/db';
import redisClient from '../config/redis';
import { sendOTP } from '../utils/mailer';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import bcrypt from 'bcryptjs';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

const generateToken = (userId: string) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
};

const isEmail = (id: string) => id.includes('@');

// ==========================================
// 1. REQUEST OTP (For Login OR Registration)
// ==========================================
export const requestOtp = async (req: Request, res: Response) => {
  try {
    const { id } = req.body; // 'id' can be email or phone
    if (!id) return res.status(400).json({ error: 'Email or Phone is required' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save to Redis for 5 minutes
    await redisClient.setEx(`otp:${id}`, 300, otp);

    if (isEmail(id)) {
      await sendOTP(id, otp);
    } else {
      // TODO: Integrate SMS gateway like Twilio or Fast2SMS here
      console.log(`[SMS MOCK] OTP for ${id} is ${otp}`);
    }

    res.status(200).json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Request OTP Error:', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
};

// ==========================================
// 2. REGISTER NEW USER (Requires OTP)
// ==========================================
export const register = async (req: Request, res: Response) => {
  try {
    const { id, password, full_name, otp } = req.body;

    if (!id || !password || !full_name || !otp) {
      return res.status(400).json({ error: 'All fields including OTP are required' });
    }

    // Verify OTP first
    const storedOtp = await redisClient.get(`otp:${id}`);
    if (!storedOtp || storedOtp !== otp) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // Check if user already exists
    const idQuery = isEmail(id) ? { email: id } : { phone_number: id };
    const existingUser = await prisma.user.findUnique({ where: idQuery });
    
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this ID already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        ...idQuery,
        full_name,
        password_hash,
      }
    });

    await redisClient.del(`otp:${id}`); // Clean up OTP
    const token = generateToken(user.id);

    res.status(201).json({ message: 'Registration successful', token, user });
  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
};

// ==========================================
// 3. LOGIN WITH ID & PASSWORD
// ==========================================
export const loginWithPassword = async (req: Request, res: Response) => {
  try {
    const { id, password } = req.body;
    if (!id || !password) return res.status(400).json({ error: 'ID and password required' });

    const idQuery = isEmail(id) ? { email: id } : { phone_number: id };
    const user = await prisma.user.findUnique({ where: idQuery });

    if (!user || !user.password_hash) {
      return res.status(400).json({ error: 'Invalid credentials or user registered via Google/OTP' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    const token = generateToken(user.id);
    res.status(200).json({ message: 'Login successful', token, user });
  } catch (error) {
    console.error('Password Login Error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
};

// ==========================================
// 4. PASSWORDLESS LOGIN (OTP Verify)
// ==========================================
export const verifyOtp = async (req: Request, res: Response) => {
  try {
    const { id, otp } = req.body;
    if (!id || !otp) return res.status(400).json({ error: 'ID and OTP required' });

    const storedOtp = await redisClient.get(`otp:${id}`);
    if (!storedOtp || storedOtp !== otp) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    const idQuery = isEmail(id) ? { email: id } : { phone_number: id };
    
    // Upsert creates the user if they don't exist, logs them in if they do
    const user = await prisma.user.upsert({
      where: idQuery,
      update: {},
      create: idQuery,
    });

    await redisClient.del(`otp:${id}`);
    const token = generateToken(user.id);

    res.status(200).json({ message: 'Login successful', token, user });
  } catch (error) {
    console.error('Verify OTP Error:', error);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
};

// ==========================================
// 5. GOOGLE LOGIN
// ==========================================
export const googleLogin = async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: 'Google ID Token is required' });

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) return res.status(400).json({ error: 'Invalid Google Token' });

    const user = await prisma.user.upsert({
      where: { email: payload.email },
      update: {},
      create: {
        email: payload.email,
        full_name: payload.name,
      },
    });

    const token = generateToken(user.id);
    res.status(200).json({ message: 'Google Login successful', token, user });
  } catch (error) {
    console.error('Google Login Error:', error);
    res.status(500).json({ error: 'Failed to authenticate with Google' });
  }
};