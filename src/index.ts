// src/index.ts

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
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

import adminAuthRoutes from './routes/adminAuth.routes';
import studentTestRoutes from './routes/student/test.routes'; // <-- Import Student Routes
import studentStudyRoutes from './routes/student/study.routes'; // <-- Import Student Study
import studentCurrentAffairsRoutes from './routes/student/currentAffairs.routes'; // <-- Import Student Current Affairs
import studentDashboardRoutes from './routes/student/dashboard.routes'; // <-- Import Student Dashboard Routes


import { initCronJobs } from './corn/newsAggregator'; // <-- Import Cron Job init

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
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

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/student/tests', studentTestRoutes); // <-- Mount Student Routes
app.use('/api/v1/student/articles', studentCurrentAffairsRoutes); // <-- Mount Student Articles
app.use('/api/v1/student/study', studentStudyRoutes);   // <-- Mount Student Study Routes
app.use('/api/v1/student/dashboard', studentDashboardRoutes); // <-- Mount Student Dashboard Routes

// Health Check Route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Agni Shiksha API is running', timestamp: new Date() });
});

initCronJobs(); // Start the background jobs for news aggregation

// Initialize Server
const startServer = async () => {
  try {
    // Initialize Redis first using the dynamic multi-provider setup
    await initializeRedis(); 
    
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