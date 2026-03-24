"use strict";
// src/controllers/adminAuth.controller.ts
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
exports.seedFirstAdmin = exports.adminLogin = exports.requestAdminOtp = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = __importDefault(require("../config/db"));
const redis_1 = __importDefault(require("../config/redis"));
const mailer_1 = require("../utils/mailer");
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
// Helper to generate Admin JWT
const generateAdminToken = (adminId, role) => {
    return jsonwebtoken_1.default.sign({ adminId, role }, JWT_SECRET, { expiresIn: '12h' });
};
// STEP 1: Request OTP (Verifies the email exists in admin_users)
const requestAdminOtp = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email } = req.body;
        if (!email)
            return res.status(400).json({ error: 'Email is required' });
        // Ensure this email actually belongs to an Admin
        const adminUser = yield db_1.default.adminUser.findUnique({ where: { email } });
        if (!adminUser) {
            return res.status(403).json({ error: 'Unauthorized. Not an admin account.' });
        }
        if (!adminUser.is_active) {
            return res.status(403).json({ error: 'This admin account has been deactivated.' });
        }
        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        // Save to Redis (5 mins)
        yield redis_1.default.setEx(`admin_otp:${email}`, 300, otp);
        // Send email via Nodemailer
        yield (0, mailer_1.sendOTP)(email, otp);
        res.status(200).json({ message: 'Admin OTP sent successfully' });
    }
    catch (error) {
        console.error('Admin Request OTP Error:', error);
        res.status(500).json({ error: 'Failed to request OTP' });
    }
});
exports.requestAdminOtp = requestAdminOtp;
// STEP 2: Verify OTP + Validate Password
const adminLogin = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, otp, password } = req.body;
        if (!email || !otp || !password) {
            return res.status(400).json({ error: 'Email, OTP, and Password are required' });
        }
        // 1. Verify OTP First (Protects against password brute-forcing)
        const storedOtp = yield redis_1.default.get(`admin_otp:${email}`);
        if (!storedOtp)
            return res.status(400).json({ error: 'OTP expired or not found' });
        if (storedOtp !== otp)
            return res.status(400).json({ error: 'Invalid OTP' });
        // 2. Fetch Admin User
        const adminUser = yield db_1.default.adminUser.findUnique({ where: { email } });
        if (!adminUser)
            return res.status(404).json({ error: 'Admin not found' });
        // 3. Verify Password
        const isPasswordValid = yield bcryptjs_1.default.compare(password, adminUser.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid password' });
        }
        // Success! Delete OTP so it cannot be reused
        yield redis_1.default.del(`admin_otp:${email}`);
        // Update last login timestamp
        yield db_1.default.adminUser.update({
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
    }
    catch (error) {
        console.error('Admin Login Error:', error);
        res.status(500).json({ error: 'Failed to process admin login' });
    }
});
exports.adminLogin = adminLogin;
// DEV ONLY: Helper endpoint to create your first Admin account
// You should remove or comment out this endpoint before going to production!
const seedFirstAdmin = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password, name, role } = req.body;
        if (!email || !password || !name) {
            console.error('Seed Admin Error: Email, Password, and Name are required');
            return res.status(400).json({ error: 'Email, Password, and Name are required' });
        }
        else {
            console.log('Seeding first admin with email:', email);
        }
        const existingAdmin = yield db_1.default.adminUser.findUnique({ where: { email } });
        if (existingAdmin)
            return res.status(400).json({ error: 'Admin already exists' });
        const salt = yield bcryptjs_1.default.genSalt(12);
        const password_hash = yield bcryptjs_1.default.hash(password, salt);
        const newAdmin = yield db_1.default.adminUser.create({
            data: {
                email,
                name,
                password_hash,
                role: role || 'super_admin'
            }
        });
        res.status(201).json({ message: 'Admin created successfully', adminId: newAdmin.id });
    }
    catch (error) {
        console.error('Seed Admin Error:', error);
        res.status(500).json({ error: 'Failed to seed admin' });
    }
});
exports.seedFirstAdmin = seedFirstAdmin;
