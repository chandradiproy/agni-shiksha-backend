"use strict";
// src/controllers/biometric.controller.ts
// FIDO2/WebAuthn Biometric Authentication Controller
// Uses @simplewebauthn/server for challenge generation and verification
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
exports.verifyRnBiometricLogin = exports.verifyRnBiometricRegistration = exports.verifyLogin = exports.getLoginOptions = exports.verifyRegistration = exports.getRegistrationOptions = void 0;
const server_1 = require("@simplewebauthn/server");
const db_1 = __importDefault(require("../config/db"));
const redis_1 = __importDefault(require("../config/redis"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const RP_NAME = process.env.WEBAUTHN_RP_NAME || 'AgniShiksha';
const RP_ID = process.env.WEBAUTHN_RP_ID || 'localhost';
const ORIGIN = process.env.WEBAUTHN_ORIGIN || 'http://localhost:8000';
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'fallback_access_secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'fallback_refresh_secret';
// ==========================================
// 1. REGISTRATION: Generate Options
// ==========================================
const getRegistrationOptions = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const user = yield db_1.default.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, full_name: true }
        });
        if (!user)
            return res.status(404).json({ error: 'User not found' });
        // Get user's existing credentials to exclude
        const existingCredentials = yield db_1.default.userCredential.findMany({
            where: { user_id: userId },
            select: { credential_id: true, transports: true }
        });
        const options = yield (0, server_1.generateRegistrationOptions)({
            rpName: RP_NAME,
            rpID: RP_ID,
            userName: user.email || user.id,
            userDisplayName: user.full_name || 'Agni Shiksha User',
            attestationType: 'none', // We don't need hardware attestation for a mobile app
            excludeCredentials: existingCredentials.map((cred) => ({
                id: cred.credential_id,
                transports: cred.transports || [],
            })),
            authenticatorSelection: {
                residentKey: 'preferred',
                userVerification: 'required', // Force biometric/PIN verification on the device
                authenticatorAttachment: 'platform', // Only use the device's built-in authenticator
            },
        });
        // Store the challenge in Redis for 5 minutes (keyed by userId)
        yield redis_1.default.setEx(`webauthn_challenge:${userId}`, 300, JSON.stringify(options.challenge));
        res.status(200).json({ success: true, data: options });
    }
    catch (error) {
        console.error('Get Registration Options Error:', error);
        res.status(500).json({ error: 'Failed to generate registration options' });
    }
});
exports.getRegistrationOptions = getRegistrationOptions;
// ==========================================
// 2. REGISTRATION: Verify & Store Credential
// ==========================================
const verifyRegistration = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = req.user.id;
        const { attestationResponse } = req.body;
        // Retrieve the challenge from Redis
        const storedChallenge = yield redis_1.default.get(`webauthn_challenge:${userId}`);
        if (!storedChallenge) {
            return res.status(400).json({ error: 'Registration challenge expired. Please try again.' });
        }
        const expectedChallenge = JSON.parse(storedChallenge);
        const verification = yield (0, server_1.verifyRegistrationResponse)({
            response: attestationResponse,
            expectedChallenge,
            expectedOrigin: ORIGIN,
            expectedRPID: RP_ID,
        });
        if (!verification.verified || !verification.registrationInfo) {
            return res.status(400).json({ error: 'Biometric registration verification failed' });
        }
        const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
        // Store the credential in the database
        yield db_1.default.$transaction([
            db_1.default.userCredential.create({
                data: {
                    user_id: userId,
                    credential_id: credential.id,
                    public_key: Buffer.from(credential.publicKey),
                    counter: BigInt(credential.counter),
                    device_type: credentialDeviceType,
                    backed_up: credentialBackedUp,
                    transports: ((_a = attestationResponse.response) === null || _a === void 0 ? void 0 : _a.transports) || [],
                }
            }),
            // Enable biometric flag on user
            db_1.default.user.update({
                where: { id: userId },
                data: { biometric_enabled: true }
            })
        ]);
        // Clean up the challenge
        yield redis_1.default.del(`webauthn_challenge:${userId}`);
        res.status(201).json({
            success: true,
            message: 'Biometric credential registered successfully',
        });
    }
    catch (error) {
        console.error('Verify Registration Error:', error);
        res.status(500).json({ error: 'Failed to verify biometric registration' });
    }
});
exports.verifyRegistration = verifyRegistration;
// ==========================================
// 3. LOGIN: Generate Authentication Options
// ==========================================
const getLoginOptions = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ error: 'User ID is required for biometric login' });
        }
        // Get user's registered credentials
        const credentials = yield db_1.default.userCredential.findMany({
            where: { user_id: userId },
            select: { credential_id: true, transports: true }
        });
        if (credentials.length === 0) {
            return res.status(404).json({ error: 'No biometric credentials registered for this user' });
        }
        const options = yield (0, server_1.generateAuthenticationOptions)({
            rpID: RP_ID,
            allowCredentials: credentials.map((cred) => ({
                id: cred.credential_id,
                transports: cred.transports || [],
            })),
            userVerification: 'required',
        });
        // Store the challenge in Redis
        yield redis_1.default.setEx(`webauthn_auth_challenge:${userId}`, 300, JSON.stringify(options.challenge));
        res.status(200).json({ success: true, data: options });
    }
    catch (error) {
        console.error('Get Login Options Error:', error);
        res.status(500).json({ error: 'Failed to generate authentication options' });
    }
});
exports.getLoginOptions = getLoginOptions;
// ==========================================
// 4. LOGIN: Verify Assertion & Issue Tokens
// ==========================================
const verifyLogin = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId, assertionResponse } = req.body;
        if (!userId || !assertionResponse) {
            return res.status(400).json({ error: 'User ID and assertion response are required' });
        }
        // Retrieve challenge
        const storedChallenge = yield redis_1.default.get(`webauthn_auth_challenge:${userId}`);
        if (!storedChallenge) {
            return res.status(400).json({ error: 'Authentication challenge expired. Please try again.' });
        }
        const expectedChallenge = JSON.parse(storedChallenge);
        // Find the credential in our database
        const credential = yield db_1.default.userCredential.findUnique({
            where: { credential_id: assertionResponse.id }
        });
        if (!credential || credential.user_id !== userId) {
            return res.status(401).json({ error: 'Credential not found or does not belong to this user' });
        }
        const verification = yield (0, server_1.verifyAuthenticationResponse)({
            response: assertionResponse,
            expectedChallenge,
            expectedOrigin: ORIGIN,
            expectedRPID: RP_ID,
            credential: {
                id: credential.credential_id,
                publicKey: credential.public_key,
                counter: Number(credential.counter),
                transports: credential.transports || [],
            },
        });
        if (!verification.verified) {
            return res.status(401).json({ error: 'Biometric authentication failed' });
        }
        // Update the counter for replay protection
        yield db_1.default.userCredential.update({
            where: { id: credential.id },
            data: { counter: BigInt(verification.authenticationInfo.newCounter) }
        });
        // Check user status
        const user = yield db_1.default.user.findUnique({
            where: { id: userId },
            select: { id: true, full_name: true, email: true, is_active: true, is_banned: true, is_premium: true }
        });
        if (!user || !user.is_active) {
            return res.status(403).json({ error: 'Account has been deactivated' });
        }
        if (user.is_banned) {
            return res.status(403).json({ error: 'Account has been suspended' });
        }
        // Generate token pair
        const accessToken = jsonwebtoken_1.default.sign({ userId: user.id, type: 'access' }, JWT_ACCESS_SECRET, { expiresIn: '15m' });
        const refreshToken = jsonwebtoken_1.default.sign({ userId: user.id, type: 'refresh' }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
        // Store session
        const salt = yield bcryptjs_1.default.genSalt(10);
        const tokenHash = yield bcryptjs_1.default.hash(refreshToken, salt);
        setImmediate(() => __awaiter(void 0, void 0, void 0, function* () {
            try {
                yield db_1.default.userSession.create({
                    data: {
                        user_id: user.id,
                        jwt_token_hash: tokenHash,
                        device_fingerprint: req.body.device_fingerprint || 'biometric',
                        device_name: req.body.device_name || null,
                        ip_address: req.ip || req.socket.remoteAddress || 'unknown',
                        user_agent: req.headers['user-agent'] || null,
                        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                    }
                });
            }
            catch (e) {
                console.error('[Biometric Session Create Error]:', e);
            }
        }));
        // Clean up challenge
        yield redis_1.default.del(`webauthn_auth_challenge:${userId}`);
        res.status(200).json({
            success: true,
            message: 'Biometric login successful',
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                is_premium: user.is_premium,
            }
        });
    }
    catch (error) {
        console.error('Verify Login Error:', error);
        res.status(500).json({ error: 'Failed to verify biometric authentication' });
    }
});
exports.verifyLogin = verifyLogin;
// ==========================================
// 5. ANDROID NATIVE: Register RSA Key (react-native-biometrics)
// ==========================================
const crypto_1 = __importDefault(require("crypto"));
const verifyRnBiometricRegistration = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = req.user.id;
        const { publicKey } = req.body;
        if (!publicKey) {
            return res.status(400).json({ error: 'Public key is required' });
        }
        // Format to PEM if it arrives as raw Base64
        const pemKey = publicKey.includes('BEGIN PUBLIC KEY')
            ? publicKey
            : `-----BEGIN PUBLIC KEY-----\n${(_a = publicKey.match(/.{1,64}/g)) === null || _a === void 0 ? void 0 : _a.join('\n')}\n-----END PUBLIC KEY-----`;
        yield db_1.default.$transaction([
            db_1.default.userCredential.create({
                data: {
                    user_id: userId,
                    credential_id: `android_rsa_${Date.now()}`,
                    public_key: Buffer.from(pemKey), // Store the PEM string directly in the buffer
                    counter: BigInt(0),
                    device_type: 'android_keystore',
                    backed_up: false,
                }
            }),
            db_1.default.user.update({
                where: { id: userId },
                data: { biometric_enabled: true }
            })
        ]);
        res.status(201).json({ success: true, message: 'RSA Biometric key successfully registered' });
    }
    catch (error) {
        console.error('RN Biometric Register Error:', error);
        res.status(500).json({ error: 'Failed to register device biometric key' });
    }
});
exports.verifyRnBiometricRegistration = verifyRnBiometricRegistration;
// ==========================================
// 6. ANDROID NATIVE: Verify Login Signature (react-native-biometrics)
// ==========================================
const verifyRnBiometricLogin = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId, signature, payload } = req.body;
        if (!userId || !signature || !payload) {
            return res.status(400).json({ error: 'User ID, signature, and payload are required' });
        }
        // 1. Validate payload timestamp to prevent replay attacks
        const parts = payload.split('_');
        const timestamp = parseInt(parts[1], 10);
        if (!timestamp || Date.now() - timestamp > 60000) {
            return res.status(401).json({ error: 'Biometric Login Expired. Please try again.' });
        }
        if (parts[0] !== userId) {
            return res.status(401).json({ error: 'Payload user mismatch' });
        }
        // 2. Fetch User's RSA Keys
        const credentials = yield db_1.default.userCredential.findMany({
            where: { user_id: userId, device_type: 'android_keystore' }
        });
        if (credentials.length === 0) {
            return res.status(404).json({ error: 'No biometric hardware keys found for this device' });
        }
        // 3. Verify Signature against any valid stored key
        let verified = false;
        for (const cred of credentials) {
            const pemKey = Buffer.from(cred.public_key).toString('utf8');
            try {
                const isVerified = crypto_1.default.verify('RSA-SHA256', Buffer.from(payload), pemKey, Buffer.from(signature, 'base64'));
                if (isVerified) {
                    verified = true;
                    break;
                }
            }
            catch (e) {
                // Skip invalid keys
            }
        }
        if (!verified) {
            return res.status(401).json({ error: 'Biometric signature rejected. Invalid key.' });
        }
        // 4. Log the user in
        const user = yield db_1.default.user.findUnique({
            where: { id: userId },
            select: { id: true, full_name: true, email: true, is_active: true, is_banned: true, is_premium: true }
        });
        if (!user || !user.is_active || user.is_banned) {
            return res.status(403).json({ error: 'Account disabled or suspended' });
        }
        const accessToken = jsonwebtoken_1.default.sign({ userId: user.id, type: 'access' }, JWT_ACCESS_SECRET, { expiresIn: '15m' });
        const refreshToken = jsonwebtoken_1.default.sign({ userId: user.id, type: 'refresh' }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
        const salt = yield bcryptjs_1.default.genSalt(10);
        const tokenHash = yield bcryptjs_1.default.hash(refreshToken, salt);
        setImmediate(() => __awaiter(void 0, void 0, void 0, function* () {
            try {
                yield db_1.default.userSession.create({
                    data: {
                        user_id: user.id,
                        jwt_token_hash: tokenHash,
                        device_fingerprint: 'android_biometric',
                        ip_address: req.ip || req.socket.remoteAddress || 'unknown',
                        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                    }
                });
            }
            catch (e) { }
        }));
        res.status(200).json({
            success: true,
            message: 'Biometric login successful',
            accessToken,
            refreshToken,
            user
        });
    }
    catch (error) {
        console.error('RN Biometric Login Error:', error);
        res.status(500).json({ error: 'Failed to verify native signature' });
    }
});
exports.verifyRnBiometricLogin = verifyRnBiometricLogin;
