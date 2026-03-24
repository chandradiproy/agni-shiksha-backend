"use strict";
// src/middlewares/adminAuth.ts
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
exports.requireRole = exports.requireAdmin = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = __importDefault(require("../config/db"));
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const requireAdmin = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
        }
        const token = authHeader.split(' ')[1];
        // Verify the JWT
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        // Verify the admin still exists and is active in the database
        const adminUser = yield db_1.default.adminUser.findUnique({
            where: { id: decoded.adminId }
        });
        if (!adminUser || !adminUser.is_active) {
            return res.status(403).json({ error: 'Forbidden: Admin account disabled or deleted' });
        }
        // Attach admin info to request for downstream controllers to use
        req.admin = {
            id: adminUser.id,
            role: adminUser.role,
            email: adminUser.email
        };
        next();
    }
    catch (error) {
        console.error('Admin Auth Middleware Error:', error);
        return res.status(401).json({ error: 'Unauthorized: Token expired or invalid' });
    }
});
exports.requireAdmin = requireAdmin;
// Optional: Role-based Guard (e.g., for Super Admins only)
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        const admin = req.admin;
        if (!admin || !allowedRoles.includes(admin.role)) {
            return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
        }
        next();
    };
};
exports.requireRole = requireRole;
