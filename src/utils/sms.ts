// src/utils/sms.ts
// Dual-provider SMS OTP service with factory pattern.
// Switch providers via SMS_PROVIDER in .env: 'fast2sms' | 'firebase' | 'mock'

import axios from 'axios';
import redisClient from '../config/redis';

const SMS_PROVIDER = process.env.SMS_PROVIDER || 'mock';

// ==========================================
// Provider Interface
// ==========================================
interface SmsProvider {
  sendOtp(phone: string, otp: string): Promise<void>;
}

// ==========================================
// Provider 1: Fast2SMS (Production — India)
// ==========================================
class Fast2SmsProvider implements SmsProvider {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.FAST2SMS_API_KEY || '';
    if (!this.apiKey) {
      console.warn('[SMS] FAST2SMS_API_KEY is not set. SMS delivery will fail.');
    }
  }

  async sendOtp(phone: string, otp: string): Promise<void> {
    // Strip +91 prefix if present, Fast2SMS expects 10-digit numbers
    const cleanPhone = phone.replace(/^\+91/, '').replace(/\s/g, '');

    try {
      const response = await axios.get('https://www.fast2sms.com/dev/bulkV2', {
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

      if (response.data?.return === false) {
        console.error('[Fast2SMS] API Error:', response.data?.message);
        throw new Error('SMS delivery failed');
      }

      console.log(`[Fast2SMS] OTP sent to ${cleanPhone}`);
    } catch (error: any) {
      console.error('[Fast2SMS] Error:', error.message);
      throw new Error('Failed to send SMS OTP');
    }
  }
}

// ==========================================
// Provider 2: Firebase Phone Auth (Development)
// ==========================================
class FirebasePhoneProvider implements SmsProvider {
  async sendOtp(phone: string, otp: string): Promise<void> {
    // Firebase handles OTP sending on the client side via verifyPhoneNumber() SDK.
    // The backend stores the OTP in Redis so it can verify it when the client sends
    // the code back. In development, Firebase test phone numbers can be configured
    // in Firebase Console → Authentication → Sign-in method → Phone → Test phone numbers.
    
    const cleanPhone = phone.replace(/\s/g, '');
    await redisClient.setEx(`otp:${cleanPhone}`, 300, otp);
    console.log(`[Firebase Phone Auth] OTP stored for ${cleanPhone} (client handles SMS delivery)`);
  }
}

// ==========================================
// Provider 3: Mock (Local dev — no external services)
// ==========================================
class MockSmsProvider implements SmsProvider {
  async sendOtp(phone: string, otp: string): Promise<void> {
    console.log(`\n=============================================`);
    console.log(`[SMS MOCK] OTP for ${phone}: ${otp}`);
    console.log(`=============================================\n`);
  }
}

// ==========================================
// Factory Function
// ==========================================
const createSmsProvider = (): SmsProvider => {
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
export const sendSmsOtp = async (phone: string, otp: string): Promise<void> => {
  await smsProvider.sendOtp(phone, otp);
};

export default sendSmsOtp;
