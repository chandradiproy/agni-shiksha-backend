// src/config/firebase.ts
import * as admin from 'firebase-admin';
import dotenv from 'dotenv';

import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

/**
 * Professional Firebase Admin SDK Initialization
 * Requires FIREBASE_SERVICE_ACCOUNT_JSON or individual credentials in .env
 */
const initializeFirebase = () => {
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
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          }),
        });
      }
      console.log('Firebase Admin SDK initialized successfully.');
    }
  } catch (error) {
    console.error('Firebase Admin Initialization Error:', error);
  }
};

export default initializeFirebase;