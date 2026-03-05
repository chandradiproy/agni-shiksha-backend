// src/index.ts

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import { initializeRedis } from './config/redis'; // Imports from src/config/redis/index.ts
import authRoutes from './routes/auth.routes';
import adminAuthRoutes from './routes/adminAuth.routes';
import contentRoutes from './routes/admin/content.routes'; // Import content routes
import adminQuestionRoutes from './routes/admin/question.routes'; // Import question routes
import adminDashboardRoutes from './routes/admin/dashboard.routes'; // Import dashboard routes
import adminUserRoutes from './routes/admin/user.routes'; // Import user routes

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json()); // Parses incoming JSON requests
app.use(morgan('dev')); // Logs API requests, methods, and status codes to the terminal

// Mount Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin/auth', adminAuthRoutes);
app.use('/api/v1/admin/content', contentRoutes); // Mount content routes under /api/v1/admin
app.use('/api/v1/admin/questions', adminQuestionRoutes); // <-- Mount Question routes
app.use('/api/v1/admin/dashboard', adminDashboardRoutes); // <-- Mount Dashboard
app.use('/api/v1/admin/users', adminUserRoutes);          // <-- Mount Users

// Health Check Route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Agni Shiksha API is running', timestamp: new Date() });
});

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