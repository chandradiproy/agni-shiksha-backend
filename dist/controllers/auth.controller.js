"use strict";
// src/controllers/auth.controller.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.testPushNotification = exports.updateFcmToken = exports.deleteAccount = exports.resetPassword = exports.forgotPassword = exports.updateMe = exports.getMe = exports.logoutAll = exports.logout = exports.refreshToken = exports.googleLogin = exports.verifyOtp = exports.loginWithPassword = exports.register = exports.requestOtp = void 0;
const db_1 = __importDefault(require("../config/db"));
const redis_1 = __importDefault(require("../config/redis"));
const mailer_1 = require("../utils/mailer");
const sms_1 = require("../utils/sms");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const google_auth_library_1 = require("google-auth-library");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const admin = __importStar(require("firebase-admin"));
const notification_service_1 = require("../services/notification.service");
const googleClient = new google_auth_library_1.OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'fallback_access_secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'fallback_refresh_secret';
// ==========================================
// TOKEN GENERATION (Access + Refresh Pair)
// ==========================================
const generateAccessToken = (userId) => {
    return jsonwebtoken_1.default.sign({ userId, type: 'access' }, JWT_ACCESS_SECRET, { expiresIn: '15m' });
};
const generateRefreshToken = (userId) => {
    return jsonwebtoken_1.default.sign({ userId, type: 'refresh' }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
};
/**
 * Generates an access + refresh token pair and stores the refresh session in the database.
 * Uses the existing UserSession model that was previously unused.
 */
const generateTokenPair = (userId, req) => __awaiter(void 0, void 0, void 0, function* () {
    const accessToken = generateAccessToken(userId);
    const refreshToken = generateRefreshToken(userId);
    // Hash the refresh token before storing (so even if DB leaks, tokens can't be used)
    const salt = yield bcryptjs_1.default.genSalt(10);
    const tokenHash = yield bcryptjs_1.default.hash(refreshToken, salt);
    // Store session (fire-and-forget for performance — login response should be instant)
    setImmediate(() => __awaiter(void 0, void 0, void 0, function* () {
        try {
            yield db_1.default.userSession.create({
                data: {
                    user_id: userId,
                    jwt_token_hash: tokenHash,
                    device_fingerprint: req.body.device_fingerprint || 'unknown',
                    device_name: req.body.device_name || null,
                    ip_address: req.ip || req.socket.remoteAddress || 'unknown',
                    user_agent: req.headers['user-agent'] || null,
                    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
                }
            });
        }
        catch (e) {
            console.error('[Session Create Error]:', e);
        }
    }));
    return { accessToken, refreshToken };
});
const isEmail = (id) => id.includes('@');
// ==========================================
// HELPER: Generate & Send OTP
// ==========================================
const generateAndSendOtp = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    // Save to Redis for 5 minutes
    yield redis_1.default.setEx(`otp:${id}`, 300, otp);
    if (isEmail(id)) {
        yield (0, mailer_1.sendEmailOTP)(id, otp);
    }
    else {
        yield (0, sms_1.sendSmsOtp)(id, otp);
    }
});
// ==========================================
// 1. REQUEST OTP (For Login OR Registration)
// ==========================================
const requestOtp = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.body;
        yield generateAndSendOtp(id);
        res.status(200).json({ success: true, message: 'OTP sent successfully' });
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
        // Verify OTP
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
        const tokens = yield generateTokenPair(user.id, req);
        res.status(201).json({
            success: true,
            message: 'Registration successful',
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                phone_number: user.phone_number,
                avatar_id: user.avatar_id,
                level: user.level,
                xp_total: user.xp_total,
                is_premium: user.is_premium,
                onboarding_completed: user.onboarding_completed
            }
        });
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
        const idQuery = isEmail(id) ? { email: id } : { phone_number: id };
        const user = yield db_1.default.user.findUnique({ where: idQuery });
        if (!user || !user.password_hash) {
            return res.status(400).json({ error: 'Invalid credentials or user registered via Google/OTP' });
        }
        if (!user.is_active) {
            return res.status(403).json({ error: 'Account has been deactivated' });
        }
        if (user.is_banned) {
            return res.status(403).json({ error: 'Account has been suspended' });
        }
        const isMatch = yield bcryptjs_1.default.compare(password, user.password_hash);
        if (!isMatch)
            return res.status(400).json({ error: 'Invalid credentials' });
        const tokens = yield generateTokenPair(user.id, req);
        res.status(200).json({
            success: true,
            message: 'Login successful',
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                phone_number: user.phone_number,
                avatar_id: user.avatar_id,
                level: user.level,
                xp_total: user.xp_total,
                is_premium: user.is_premium,
                onboarding_completed: user.onboarding_completed
            }
        });
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
        if (!user.is_active) {
            return res.status(403).json({ error: 'Account has been deactivated' });
        }
        if (user.is_banned) {
            return res.status(403).json({ error: 'Account has been suspended' });
        }
        yield redis_1.default.del(`otp:${id}`);
        const tokens = yield generateTokenPair(user.id, req);
        res.status(200).json({
            success: true,
            message: 'Login successful',
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                phone_number: user.phone_number,
                avatar_id: user.avatar_id,
                level: user.level,
                xp_total: user.xp_total,
                is_premium: user.is_premium,
                onboarding_completed: user.onboarding_completed
            }
        });
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
        if (!user.is_active) {
            return res.status(403).json({ error: 'Account has been deactivated' });
        }
        const tokens = yield generateTokenPair(user.id, req);
        res.status(200).json({
            success: true,
            message: 'Google Login successful',
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                phone_number: user.phone_number,
                avatar_id: user.avatar_id,
                level: user.level,
                xp_total: user.xp_total,
                is_premium: user.is_premium,
                onboarding_completed: user.onboarding_completed
            }
        });
    }
    catch (error) {
        console.error('Google Login Error:', error);
        res.status(500).json({ error: 'Failed to authenticate with Google' });
    }
});
exports.googleLogin = googleLogin;
// ==========================================
// 6. REFRESH TOKEN
// ==========================================
const refreshToken = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { refreshToken: oldRefreshToken } = req.body;
        // 1. Verify the refresh JWT signature and expiry
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(oldRefreshToken, JWT_REFRESH_SECRET);
        }
        catch (_a) {
            return res.status(401).json({ error: 'Refresh token is invalid or expired' });
        }
        if (decoded.type !== 'refresh') {
            return res.status(401).json({ error: 'Invalid token type' });
        }
        // 2. Find all active sessions for this user and check if this refresh token matches one
        const activeSessions = yield db_1.default.userSession.findMany({
            where: {
                user_id: decoded.userId,
                is_active: true,
                expires_at: { gt: new Date() },
            }
        });
        let matchedSession = null;
        for (const session of activeSessions) {
            const isMatch = yield bcryptjs_1.default.compare(oldRefreshToken, session.jwt_token_hash);
            if (isMatch) {
                matchedSession = session;
                break;
            }
        }
        if (!matchedSession) {
            return res.status(401).json({ error: 'Session not found or already revoked' });
        }
        // 3. Invalidate the old session (rotation — each refresh token is single-use)
        yield db_1.default.userSession.update({
            where: { id: matchedSession.id },
            data: { is_active: false }
        });
        // 4. Generate new token pair
        const tokens = yield generateTokenPair(decoded.userId, req);
        res.status(200).json({
            success: true,
            message: 'Token refreshed successfully',
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
        });
    }
    catch (error) {
        console.error('Refresh Token Error:', error);
        res.status(500).json({ error: 'Failed to refresh token' });
    }
});
exports.refreshToken = refreshToken;
// ==========================================
// 7. LOGOUT (Single Session)
// ==========================================
const logout = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const sessionId = req.user.sessionId;
        if (sessionId) {
            yield db_1.default.userSession.update({
                where: { id: sessionId },
                data: { is_active: false }
            });
        }
        res.status(200).json({ success: true, message: 'Logged out successfully' });
    }
    catch (error) {
        console.error('Logout Error:', error);
        res.status(500).json({ error: 'Failed to logout' });
    }
});
exports.logout = logout;
// ==========================================
// 8. LOGOUT ALL (Revoke All Sessions)
// ==========================================
const logoutAll = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const result = yield db_1.default.userSession.updateMany({
            where: { user_id: userId, is_active: true },
            data: { is_active: false }
        });
        res.status(200).json({
            success: true,
            message: `Logged out from ${result.count} session(s)`,
            sessions_revoked: result.count,
        });
    }
    catch (error) {
        console.error('Logout All Error:', error);
        res.status(500).json({ error: 'Failed to logout from all devices' });
    }
});
exports.logoutAll = logoutAll;
// ==========================================
// 9. GET CURRENT USER PROFILE
// ==========================================
const getMe = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const user = yield db_1.default.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                phone_number: true,
                full_name: true,
                avatar_id: true,
                target_exam_id: true,
                is_premium: true,
                premium_plan_id: true,
                premium_expires_at: true,
                xp_total: true,
                gems: true,
                level: true,
                current_streak: true,
                longest_streak: true,
                last_activity_date: true,
                is_active: true,
                onboarding_completed: true,
                referral_code: true,
                created_at: true,
                // Explicitly excluded: password_hash, is_banned (internal), deleted_at
            }
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json({ success: true, data: user });
    }
    catch (error) {
        console.error('Get Profile Error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});
exports.getMe = getMe;
// ==========================================
// 10. UPDATE USER PROFILE
// ==========================================
const updateMe = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        // Only allow updating specific safe fields
        const allowedFields = {};
        const updatableFields = ['full_name', 'avatar_id', 'target_exam_id', 'study_language', 'prep_level', 'daily_study_hours'];
        for (const field of updatableFields) {
            if (req.body[field] !== undefined) {
                allowedFields[field] = req.body[field];
            }
        }
        if (Object.keys(allowedFields).length === 0) {
            return res.status(400).json({ error: 'No updatable fields provided' });
        }
        const updatedUser = yield db_1.default.user.update({
            where: { id: userId },
            data: allowedFields,
            select: {
                id: true,
                email: true,
                phone_number: true,
                full_name: true,
                avatar_id: true,
                target_exam_id: true,
                is_premium: true,
                xp_total: true,
                level: true,
                current_streak: true,
            }
        });
        res.status(200).json({ success: true, message: 'Profile updated successfully', data: updatedUser });
    }
    catch (error) {
        console.error('Update Profile Error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});
exports.updateMe = updateMe;
// ==========================================
// 11. FORGOT PASSWORD (Send OTP)
// ==========================================
const forgotPassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.body;
        // Verify user exists
        const idQuery = isEmail(id) ? { email: id } : { phone_number: id };
        const user = yield db_1.default.user.findUnique({ where: idQuery });
        if (!user) {
            // Return success even if user doesn't exist (prevents user enumeration)
            return res.status(200).json({ success: true, message: 'If an account exists, an OTP has been sent' });
        }
        yield generateAndSendOtp(id);
        res.status(200).json({ success: true, message: 'If an account exists, an OTP has been sent' });
    }
    catch (error) {
        console.error('Forgot Password Error:', error);
        res.status(500).json({ error: 'Failed to process forgot password request' });
    }
});
exports.forgotPassword = forgotPassword;
// ==========================================
// 12. RESET PASSWORD (Verify OTP + Set New Password)
// ==========================================
const resetPassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id, otp, new_password } = req.body;
        // Verify OTP
        const storedOtp = yield redis_1.default.get(`otp:${id}`);
        if (!storedOtp || storedOtp !== otp) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }
        // Find user
        const idQuery = isEmail(id) ? { email: id } : { phone_number: id };
        const user = yield db_1.default.user.findUnique({ where: idQuery });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Hash new password and update
        const salt = yield bcryptjs_1.default.genSalt(10);
        const password_hash = yield bcryptjs_1.default.hash(new_password, salt);
        yield db_1.default.$transaction([
            // 1. Update password
            db_1.default.user.update({
                where: { id: user.id },
                data: { password_hash }
            }),
            // 2. Invalidate ALL sessions for security
            db_1.default.userSession.updateMany({
                where: { user_id: user.id, is_active: true },
                data: { is_active: false }
            })
        ]);
        yield redis_1.default.del(`otp:${id}`);
        res.status(200).json({ success: true, message: 'Password reset successful. Please login with your new password.' });
    }
    catch (error) {
        console.error('Reset Password Error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});
exports.resetPassword = resetPassword;
// ==========================================
// 13. DELETE ACCOUNT (GDPR Soft-Delete)
// ==========================================
const deleteAccount = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        // If user has a password, optionally verify it for security
        if (req.body.password) {
            const user = yield db_1.default.user.findUnique({ where: { id: userId }, select: { password_hash: true } });
            if (user === null || user === void 0 ? void 0 : user.password_hash) {
                const isMatch = yield bcryptjs_1.default.compare(req.body.password, user.password_hash);
                if (!isMatch) {
                    return res.status(400).json({ error: 'Incorrect password' });
                }
            }
        }
        yield db_1.default.$transaction([
            // 1. Soft-delete the user
            db_1.default.user.update({
                where: { id: userId },
                data: {
                    is_active: false,
                    deleted_at: new Date(),
                    device_tokens: [], // Clear push notification tokens
                    device_fingerprints: [],
                }
            }),
            // 2. Invalidate all sessions
            db_1.default.userSession.updateMany({
                where: { user_id: userId, is_active: true },
                data: { is_active: false }
            })
        ]);
        res.status(200).json({ success: true, message: 'Account deleted successfully. Data will be permanently purged after 30 days.' });
    }
    catch (error) {
        console.error('Delete Account Error:', error);
        res.status(500).json({ error: 'Failed to delete account' });
    }
});
exports.deleteAccount = deleteAccount;
// ==========================================
// 14. PUSH NOTIFICATIONS (FCM)
// ==========================================
const updateFcmToken = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { token } = req.body;
        const userId = req.user.id;
        if (!token)
            return res.status(400).json({ error: 'FCM token required' });
        const user = yield db_1.default.user.findUnique({ where: { id: userId }, select: { device_tokens: true } });
        if (!user)
            return res.status(404).json({ error: 'User not found' });
        let tokens = user.device_tokens || [];
        if (!tokens.includes(token)) {
            tokens.push(token);
        }
        if (tokens.length > 5)
            tokens = tokens.slice(tokens.length - 5);
        yield db_1.default.user.update({
            where: { id: userId },
            data: { device_tokens: tokens }
        });
        yield notification_service_1.NotificationService.subscribeTokenToGlobalTopic(token);
        res.json({ success: true, message: 'FCM token registered' });
    }
    catch (err) {
        console.error('Update FCM Token error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});
exports.updateFcmToken = updateFcmToken;
const testPushNotification = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { pushType, userId } = req.body;
        if (!pushType || !userId)
            return res.status(400).json({ error: 'pushType and userId required' });
        const user = yield db_1.default.user.findUnique({ where: { id: userId }, select: { device_tokens: true } });
        if (!user || !user.device_tokens || user.device_tokens.length === 0) {
            return res.status(400).json({ error: 'User has no registered FCM tokens' });
        }
        const tokens = user.device_tokens;
        const message = {
            tokens,
            data: {
                type: pushType === 'silent' ? 'CACHE_INVALIDATE' : 'INFO',
                target: 'home_dashboard'
            },
            notification: pushType === 'alert' ? {
                title: 'New Content Arrived! 🎉',
                body: 'Pull to refresh or tap to view the latest recommended tests.'
            } : undefined,
            android: { priority: 'high' }
        };
        const response = yield admin.messaging().sendEachForMulticast(message);
        res.json({ success: true, response, message: `Sent ${pushType} push to ${tokens.length} devices.` });
    }
    catch (err) {
        console.error('Test Push Error:', err);
        res.status(500).json({ error: 'Failed to send test push.' });
    }
});
exports.testPushNotification = testPushNotification;
