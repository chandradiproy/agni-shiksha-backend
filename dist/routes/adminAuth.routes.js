"use strict";
// src/routes/adminAuth.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminAuth_controller_1 = require("../controllers/adminAuth.controller");
const router = (0, express_1.Router)();
// Endpoint to request an OTP for admin login
router.post('/request-otp', adminAuth_controller_1.requestAdminOtp);
// Endpoint to verify OTP and Password simultaneously
router.post('/login', adminAuth_controller_1.adminLogin);
// DEV ONLY: Endpoint to seed the first admin account into the database
router.post('/seed', adminAuth_controller_1.seedFirstAdmin);
exports.default = router;
