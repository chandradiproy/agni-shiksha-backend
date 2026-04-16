"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/config/firebase.ts
const admin = __importStar(require("firebase-admin"));
const dotenv_1 = __importDefault(require("dotenv"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
dotenv_1.default.config();
/**
 * Professional Firebase Admin SDK Initialization
 * Requires FIREBASE_SERVICE_ACCOUNT_JSON or individual credentials in .env
 */
const initializeFirebase = () => {
    var _a;
    try {
        if (admin.apps.length === 0) {
            // Option 1: Using a JSON string from environment variable (Recommended for production)
            if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
                const filePath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
                const serviceAccount = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount),
                });
            }
            // Option 2: Individual ENV variables fallback
            else {
                admin.initializeApp({
                    credential: admin.credential.cert({
                        projectId: process.env.FIREBASE_PROJECT_ID,
                        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                        privateKey: (_a = process.env.FIREBASE_PRIVATE_KEY) === null || _a === void 0 ? void 0 : _a.replace(/\\n/g, '\n'),
                    }),
                });
            }
            console.log('Firebase Admin SDK initialized successfully.');
        }
    }
    catch (error) {
        console.error('Firebase Admin Initialization Error:', error);
    }
};
exports.default = initializeFirebase;
