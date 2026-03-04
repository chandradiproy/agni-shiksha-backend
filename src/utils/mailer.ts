// src/utils/mailer.ts

import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Configure Nodemailer for MVP Email OTPs
const transporter = nodemailer.createTransport({
  service: 'gmail', // You can change this to 'resend' or standard SMTP later
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendOTP = async (email: string, otp: string) => {
  const mailOptions = {
    from: `"Agni Shiksha" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Your Login OTP for Agni Shiksha',
    html: `
      <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
        <h2>Agni Shiksha Authentication</h2>
        <p>Your One-Time Password (OTP) for login is:</p>
        <h1 style="color: #FF5722; letter-spacing: 5px;">${otp}</h1>
        <p>This code is valid for 5 minutes. Do not share it with anyone.</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`OTP sent to ${email}`);
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send OTP email');
  }
};