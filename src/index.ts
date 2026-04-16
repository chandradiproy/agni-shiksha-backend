// src/index.ts
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { initializeRedis } from './config/redis'; // Imports from src/config/redis/index.ts
import authRoutes from './routes/auth.routes';
import contentRoutes from './routes/admin/content.routes'; // Import content routes
import adminQuestionRoutes from './routes/admin/question.routes'; // Import question routes
import adminDashboardRoutes from './routes/admin/dashboard.routes'; // Import dashboard routes
import adminUserRoutes from './routes/admin/user.routes'; // Import user routes
import adminCurrentAffairsRoutes from './routes/admin/currentAffairs.routes'; // <-- Import Current Affairs
import adminModerationRoutes from './routes/admin/moderation.routes'; // <-- Import Moderation
import adminStudyRoutes from './routes/admin/study.routes'; // <-- Import Admin Study
import adminGamificationRoutes from './routes/admin/gamification.routes'; // <-- Import Gamification Routes
import adminAuditRoutes from './routes/admin/audit.routes'; // <-- Import Audit
import adminPlanRoutes from './routes/admin/plan.routes'; // <-- Import Plan Management Routes
import adminFinancialRoutes from './routes/admin/financial.routes';
import adminCouponRoutes from './routes/admin/coupon.routes'; // <-- Import Coupon Routes
import adminNotificationRoutes from './routes/admin/notification.routes';

import adminAuthRoutes from './routes/adminAuth.routes';
import studentTestRoutes from './routes/student/test.routes'; // <-- Import Student Routes
import studentDashboardRoutes from './routes/student/dashboard.routes'; // <-- Import Student Dashboard Routes
import analysisRoutes from './routes/student/analysis.routes';
import gamificationRoutes from './routes/student/gamification.routes';
import studyRoutes from './routes/student/study.routes';
import currentAffairsRoutes from './routes/student/currentAffairs.routes';
import socialRoutes from './routes/student/social.routes';
import premiumRoutes from './routes/student/premium.routes';
import utilityRoutes from './routes/student/utility.routes';
import homeRoutes from './routes/student/home.routes';
import studentNotificationRoutes from './routes/student/notification.routes';
import studentOnboardingRoutes from './routes/student/onboarding.routes'; // <-- Import Onboarding Routes

import { initCronJobs } from './corn/newsAggregator'; // <-- Import Cron Job init
import { schedulePremiumExpirer } from './corn/premiumExperier'; // <-- Import Premium Expirer Cron Job
import initializeFirebase from './config/firebase';
import './workers/notification.worker';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
// Rate limiter
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 500, message: { error: 'Too many requests' } });

const corsOptions = {
  origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:8081', 'exp://127.0.0.1:8081'],
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true
};

app.use(cors(corsOptions));
app.use(apiLimiter);
app.use(express.json()); // Parses incoming JSON requests
app.use(morgan('dev')); // Logs API requests, methods, and status codes to the terminal

// Mount Routes
app.use('/api/v1/admin/auth', adminAuthRoutes);
app.use('/api/v1/admin/content', contentRoutes); // Mount content routes under /api/v1/admin
app.use('/api/v1/admin/questions', adminQuestionRoutes); // <-- Mount Question routes
app.use('/api/v1/admin/dashboard', adminDashboardRoutes); // <-- Mount Dashboard
app.use('/api/v1/admin/users', adminUserRoutes);          // <-- Mount Users
app.use('/api/v1/admin/current-affairs', adminCurrentAffairsRoutes); // <-- Mount Current Affairs
app.use('/api/v1/admin/study', adminStudyRoutes);       // <-- Mount Admin Study Routes
app.use('/api/v1/admin/moderation', adminModerationRoutes); // <-- Mount Moderation Routes
app.use('/api/v1/admin/gamification', adminGamificationRoutes); // <-- Mount Gamification Routes
app.use('/api/v1/admin/audit', adminAuditRoutes);
app.use('/api/v1/admin/plans', adminPlanRoutes); // <-- Mount Plan Management Routes
app.use('/api/v1/admin/financial', adminFinancialRoutes); // <-- Mount Financial Routes
app.use('/api/v1/admin/coupons', adminCouponRoutes);
app.use('/api/v1/admin/notifications', adminNotificationRoutes);

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/student/tests', studentTestRoutes); // <-- Mount Student Routes
app.use('/api/v1/student/dashboard', studentDashboardRoutes); // <-- Mount Student Dashboard Routes
app.use('/api/v1/student/analysis', analysisRoutes);
app.use('/api/v1/student/gamification', gamificationRoutes);
app.use('/api/v1/student/study', studyRoutes);
app.use('/api/v1/student/articles', currentAffairsRoutes);
app.use('/api/v1/student/social', socialRoutes);
app.use('/api/v1/student/premium', premiumRoutes);
app.use('/api/v1/student/utilities', utilityRoutes);
app.use('/api/v1/student/home', homeRoutes);
app.use('/api/v1/student/notifications', studentNotificationRoutes);

app.use('/api/v1/onboarding', studentOnboardingRoutes);

// Health Check Route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Agni Shiksha API is running', timestamp: new Date() });
});

initCronJobs(); // Start the background jobs for news aggregation
schedulePremiumExpirer(); // Start the cron job to expire premium subscriptions

// Initialize Server
const startServer = async () => {
  try {
    // Initialize Redis first using the dynamic multi-provider setup
    await initializeRedis();
    initializeFirebase();
    
    // Start Express only after Redis successfully connects
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
