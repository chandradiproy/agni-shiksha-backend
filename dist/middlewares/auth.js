"use strict";
// src/middlewares/auth.ts
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
exports.requireAuth = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = __importDefault(require("../config/db"));
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const requireAuth = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
        }
        const token = authHeader.split(' ')[1];
        // Verify the JWT
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        // Verify user exists and is not banned
        const user = yield db_1.default.user.findUnique({
            where: { id: decoded.userId },
            select: { id: true, is_banned: true, is_active: true }
        });
        if (!user || !user.is_active) {
            return res.status(401).json({ error: 'Unauthorized: Account disabled or deleted' });
        }
        if (user.is_banned) {
            return res.status(403).json({ error: 'Forbidden: Account has been suspended for violating terms' });
        }
        // Attach user ID to request
        req.user = { id: user.id };
        next();
    }
    catch (error) {
        console.error('Student Auth Middleware Error:', error);
        return res.status(401).json({ error: 'Unauthorized: Token expired or invalid' });
    }
});
exports.requireAuth = requireAuth;
