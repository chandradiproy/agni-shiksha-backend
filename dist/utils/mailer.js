"use strict";
// src/utils/mailer.ts
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
exports.sendEmailOTP = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Configure Nodemailer for MVP Email OTPs
const transporter = nodemailer_1.default.createTransport({
    service: 'gmail', // You can change this to 'resend' or standard SMTP later
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});
const sendEmailOTP = (email, otp) => __awaiter(void 0, void 0, void 0, function* () {
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
        yield transporter.sendMail(mailOptions);
        console.log(`OTP sent to ${email}`);
    }
    catch (error) {
        console.error('Error sending email:', error);
        throw new Error('Failed to send OTP email');
    }
});
exports.sendEmailOTP = sendEmailOTP;
