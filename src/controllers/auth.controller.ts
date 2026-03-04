// src/controllers/auth.controller.ts

import { Request, Response } from 'express';
import prisma from '../config/db'; // Importing the centralized Prisma adapter
import redisClient from '../config/redis';
import { sendOTP } from '../utils/mailer';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

// Helper to generate JWT
const generateToken = (userId: string) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
};

export const requestOtp = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save to Upstash Redis with 300 seconds (5 minutes) expiry
    await redisClient.setEx(`otp:${email}`, 300, otp);

    // Send email (Using Nodemailer for MVP)
    await sendOTP(email, otp);

    res.status(200).json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Request OTP Error:', error);
    res.status(500).json({ error: 'Failed to request OTP' });
  }
};

export const verifyOtp = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required' });

    // Fetch OTP from Redis
    const storedOtp = await redisClient.get(`otp:${email}`);

    if (!storedOtp) return res.status(400).json({ error: 'OTP expired or not found' });
    if (storedOtp !== otp) return res.status(400).json({ error: 'Invalid OTP' });

    // OTP is valid. Delete it so it can't be reused
    await redisClient.del(`otp:${email}`);

    // Upsert User in Postgres using the Prisma 7 Adapter
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { 
        email,
        phone_number: `+910000000000`, // Placeholder to satisfy the new schema requirements temporarily
      },
    });

    const token = generateToken(user.id);
    res.status(200).json({ message: 'Login successful', token, user });
  } catch (error) {
    console.error('Verify OTP Error:', error);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
};

export const googleLogin = async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: 'Google ID Token is required' });

    // Verify token with Google
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) return res.status(400).json({ error: 'Invalid Google Token' });

    // Upsert User in Postgres using the Prisma 7 Adapter
    const user = await prisma.user.upsert({
      where: { email: payload.email },
      update: {},
      create: {
        email: payload.email,
        full_name: payload.name,
        phone_number: `+910000000000`, // Placeholder to satisfy the new schema requirements temporarily
      },
    });

    const token = generateToken(user.id);
    res.status(200).json({ message: 'Google Login successful', token, user });
  } catch (error) {
    console.error('Google Login Error:', error);
    res.status(500).json({ error: 'Failed to authenticate with Google' });
  }
};