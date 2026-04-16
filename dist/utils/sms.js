"use strict";
// src/utils/sms.ts
// Dual-provider SMS OTP service with factory pattern.
// Switch providers via SMS_PROVIDER in .env: 'fast2sms' | 'firebase' | 'mock'
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
exports.sendSmsOtp = void 0;
const axios_1 = __importDefault(require("axios"));
const redis_1 = __importDefault(require("../config/redis"));
const SMS_PROVIDER = process.env.SMS_PROVIDER || 'mock';
// ==========================================
// Provider 1: Fast2SMS (Production — India)
// ==========================================
class Fast2SmsProvider {
    constructor() {
        this.apiKey = process.env.FAST2SMS_API_KEY || '';
        if (!this.apiKey) {
            console.warn('[SMS] FAST2SMS_API_KEY is not set. SMS delivery will fail.');
        }
    }
    sendOtp(phone, otp) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            // Strip +91 prefix if present, Fast2SMS expects 10-digit numbers
            const cleanPhone = phone.replace(/^\+91/, '').replace(/\s/g, '');
            try {
                const response = yield axios_1.default.get('https://www.fast2sms.com/dev/bulkV2', {
                    params: {
                        authorization: this.apiKey,
                        variables_values: otp,
                        route: 'otp',
                        numbers: cleanPhone,
                    },
                    headers: {
                        'cache-control': 'no-cache',
                    },
                });
                if (((_a = response.data) === null || _a === void 0 ? void 0 : _a.return) === false) {
                    console.error('[Fast2SMS] API Error:', (_b = response.data) === null || _b === void 0 ? void 0 : _b.message);
                    throw new Error('SMS delivery failed');
                }
                console.log(`[Fast2SMS] OTP sent to ${cleanPhone}`);
            }
            catch (error) {
                console.error('[Fast2SMS] Error:', error.message);
                throw new Error('Failed to send SMS OTP');
            }
        });
    }
}
// ==========================================
// Provider 2: Firebase Phone Auth (Development)
// ==========================================
class FirebasePhoneProvider {
    sendOtp(phone, otp) {
        return __awaiter(this, void 0, void 0, function* () {
            // Firebase handles OTP sending on the client side via verifyPhoneNumber() SDK.
            // The backend stores the OTP in Redis so it can verify it when the client sends
            // the code back. In development, Firebase test phone numbers can be configured
            // in Firebase Console → Authentication → Sign-in method → Phone → Test phone numbers.
            const cleanPhone = phone.replace(/\s/g, '');
            yield redis_1.default.setEx(`otp:${cleanPhone}`, 300, otp);
            console.log(`[Firebase Phone Auth] OTP stored for ${cleanPhone} (client handles SMS delivery)`);
        });
    }
}
// ==========================================
// Provider 3: Mock (Local dev — no external services)
// ==========================================
class MockSmsProvider {
    sendOtp(phone, otp) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`\n=============================================`);
            console.log(`[SMS MOCK] OTP for ${phone}: ${otp}`);
            console.log(`=============================================\n`);
        });
    }
}
// ==========================================
// Factory Function
// ==========================================
const createSmsProvider = () => {
    switch (SMS_PROVIDER) {
        case 'fast2sms':
            return new Fast2SmsProvider();
        case 'firebase':
            return new FirebasePhoneProvider();
        case 'mock':
        default:
            return new MockSmsProvider();
    }
};
// Singleton instance
const smsProvider = createSmsProvider();
console.log(`[SMS] Provider initialized: ${SMS_PROVIDER}`);
/**
 * Send an OTP via SMS to the given phone number.
 * The actual delivery method depends on SMS_PROVIDER in .env.
 */
const sendSmsOtp = (phone, otp) => __awaiter(void 0, void 0, void 0, function* () {
    yield smsProvider.sendOtp(phone, otp);
});
exports.sendSmsOtp = sendSmsOtp;
exports.default = exports.sendSmsOtp;
