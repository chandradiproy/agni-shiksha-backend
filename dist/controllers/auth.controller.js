"use strict";
// src/controllers/auth.controller.ts
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
exports.googleLogin = exports.verifyOtp = exports.loginWithPassword = exports.register = exports.requestOtp = void 0;
const db_1 = __importDefault(require("../config/db"));
const redis_1 = __importDefault(require("../config/redis"));
const mailer_1 = require("../utils/mailer");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const google_auth_library_1 = require("google-auth-library");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const googleClient = new google_auth_library_1.OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const generateToken = (userId) => {
    return jsonwebtoken_1.default.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
};
const isEmail = (id) => id.includes('@');
// ==========================================
// 1. REQUEST OTP (For Login OR Registration)
// ==========================================
const requestOtp = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.body; // 'id' can be email or phone
        if (!id)
            return res.status(400).json({ error: 'Email or Phone is required' });
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        // Save to Redis for 5 minutes
        yield redis_1.default.setEx(`otp:${id}`, 300, otp);
        if (isEmail(id)) {
            yield (0, mailer_1.sendOTP)(id, otp);
        }
        else {
            // TODO: Integrate SMS gateway like Twilio or Fast2SMS here
            console.log(`[SMS MOCK] OTP for ${id} is ${otp}`);
        }
        res.status(200).json({ message: 'OTP sent successfully' });
    }
    catch (error) {
        console.error('Request OTP Error:', error);
        res.status(500).json({ error: 'Failed to send OTP' });
    }
});
exports.requestOtp = requestOtp;
// ==========================================
// 2. REGISTER NEW USER (Requires OTP)
// ==========================================
const register = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id, password, full_name, otp } = req.body;
        if (!id || !password || !full_name || !otp) {
            return res.status(400).json({ error: 'All fields including OTP are required' });
        }
        // Verify OTP first
        const storedOtp = yield redis_1.default.get(`otp:${id}`);
        if (!storedOtp || storedOtp !== otp) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }
        // Check if user already exists
        const idQuery = isEmail(id) ? { email: id } : { phone_number: id };
        const existingUser = yield db_1.default.user.findUnique({ where: idQuery });
        if (existingUser) {
            return res.status(400).json({ error: 'An account with this ID already exists' });
        }
        const salt = yield bcryptjs_1.default.genSalt(10);
        const password_hash = yield bcryptjs_1.default.hash(password, salt);
        const user = yield db_1.default.user.create({
            data: Object.assign(Object.assign({}, idQuery), { full_name,
                password_hash })
        });
        yield redis_1.default.del(`otp:${id}`); // Clean up OTP
        const token = generateToken(user.id);
        res.status(201).json({ message: 'Registration successful', token, user });
    }
    catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({ error: 'Failed to register user' });
    }
});
exports.register = register;
// ==========================================
// 3. LOGIN WITH ID & PASSWORD
// ==========================================
const loginWithPassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id, password } = req.body;
        if (!id || !password)
            return res.status(400).json({ error: 'ID and password required' });
        const idQuery = isEmail(id) ? { email: id } : { phone_number: id };
        const user = yield db_1.default.user.findUnique({ where: idQuery });
        if (!user || !user.password_hash) {
            return res.status(400).json({ error: 'Invalid credentials or user registered via Google/OTP' });
        }
        const isMatch = yield bcryptjs_1.default.compare(password, user.password_hash);
        if (!isMatch)
            return res.status(400).json({ error: 'Invalid credentials' });
        const token = generateToken(user.id);
        res.status(200).json({ message: 'Login successful', token, user });
    }
    catch (error) {
        console.error('Password Login Error:', error);
        res.status(500).json({ error: 'Failed to login' });
    }
});
exports.loginWithPassword = loginWithPassword;
// ==========================================
// 4. PASSWORDLESS LOGIN (OTP Verify)
// ==========================================
const verifyOtp = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id, otp } = req.body;
        if (!id || !otp)
            return res.status(400).json({ error: 'ID and OTP required' });
        const storedOtp = yield redis_1.default.get(`otp:${id}`);
        if (!storedOtp || storedOtp !== otp) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }
        const idQuery = isEmail(id) ? { email: id } : { phone_number: id };
        // Upsert creates the user if they don't exist, logs them in if they do
        const user = yield db_1.default.user.upsert({
            where: idQuery,
            update: {},
            create: idQuery,
        });
        yield redis_1.default.del(`otp:${id}`);
        const token = generateToken(user.id);
        res.status(200).json({ message: 'Login successful', token, user });
    }
    catch (error) {
        console.error('Verify OTP Error:', error);
        res.status(500).json({ error: 'Failed to verify OTP' });
    }
});
exports.verifyOtp = verifyOtp;
// ==========================================
// 5. GOOGLE LOGIN
// ==========================================
const googleLogin = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { idToken } = req.body;
        if (!idToken)
            return res.status(400).json({ error: 'Google ID Token is required' });
        const ticket = yield googleClient.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (!payload || !payload.email)
            return res.status(400).json({ error: 'Invalid Google Token' });
        const user = yield db_1.default.user.upsert({
            where: { email: payload.email },
            update: {},
            create: {
                email: payload.email,
                full_name: payload.name,
            },
        });
        const token = generateToken(user.id);
        res.status(200).json({ message: 'Google Login successful', token, user });
    }
    catch (error) {
        console.error('Google Login Error:', error);
        res.status(500).json({ error: 'Failed to authenticate with Google' });
    }
});
exports.googleLogin = googleLogin;
