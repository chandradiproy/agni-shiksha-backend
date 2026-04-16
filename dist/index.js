"use strict";
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
// src/index.ts
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const morgan_1 = __importDefault(require("morgan"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const redis_1 = require("./config/redis"); // Imports from src/config/redis/index.ts
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const content_routes_1 = __importDefault(require("./routes/admin/content.routes")); // Import content routes
const question_routes_1 = __importDefault(require("./routes/admin/question.routes")); // Import question routes
const dashboard_routes_1 = __importDefault(require("./routes/admin/dashboard.routes")); // Import dashboard routes
const user_routes_1 = __importDefault(require("./routes/admin/user.routes")); // Import user routes
const currentAffairs_routes_1 = __importDefault(require("./routes/admin/currentAffairs.routes")); // <-- Import Current Affairs
const moderation_routes_1 = __importDefault(require("./routes/admin/moderation.routes")); // <-- Import Moderation
const study_routes_1 = __importDefault(require("./routes/admin/study.routes")); // <-- Import Admin Study
const gamification_routes_1 = __importDefault(require("./routes/admin/gamification.routes")); // <-- Import Gamification Routes
const audit_routes_1 = __importDefault(require("./routes/admin/audit.routes")); // <-- Import Audit
const plan_routes_1 = __importDefault(require("./routes/admin/plan.routes")); // <-- Import Plan Management Routes
const financial_routes_1 = __importDefault(require("./routes/admin/financial.routes"));
const coupon_routes_1 = __importDefault(require("./routes/admin/coupon.routes")); // <-- Import Coupon Routes
const notification_routes_1 = __importDefault(require("./routes/admin/notification.routes"));
const adminAuth_routes_1 = __importDefault(require("./routes/adminAuth.routes"));
const test_routes_1 = __importDefault(require("./routes/student/test.routes")); // <-- Import Student Routes
const dashboard_routes_2 = __importDefault(require("./routes/student/dashboard.routes")); // <-- Import Student Dashboard Routes
const analysis_routes_1 = __importDefault(require("./routes/student/analysis.routes"));
const gamification_routes_2 = __importDefault(require("./routes/student/gamification.routes"));
const study_routes_2 = __importDefault(require("./routes/student/study.routes"));
const currentAffairs_routes_2 = __importDefault(require("./routes/student/currentAffairs.routes"));
const social_routes_1 = __importDefault(require("./routes/student/social.routes"));
const premium_routes_1 = __importDefault(require("./routes/student/premium.routes"));
const utility_routes_1 = __importDefault(require("./routes/student/utility.routes"));
const home_routes_1 = __importDefault(require("./routes/student/home.routes"));
const notification_routes_2 = __importDefault(require("./routes/student/notification.routes"));
const onboarding_routes_1 = __importDefault(require("./routes/student/onboarding.routes")); // <-- Import Onboarding Routes
const newsAggregator_1 = require("./corn/newsAggregator"); // <-- Import Cron Job init
const premiumExperier_1 = require("./corn/premiumExperier"); // <-- Import Premium Expirer Cron Job
const firebase_1 = __importDefault(require("./config/firebase"));
require("./workers/notification.worker");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 8000;
// Middleware
// Rate limiter
const apiLimiter = (0, express_rate_limit_1.default)({ windowMs: 60 * 1000, max: 500, message: { error: 'Too many requests' } });
const corsOptions = {
    origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:8081', 'exp://127.0.0.1:8081'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true
};
app.use((0, cors_1.default)(corsOptions));
app.use(apiLimiter);
app.use(express_1.default.json()); // Parses incoming JSON requests
app.use((0, morgan_1.default)('dev')); // Logs API requests, methods, and status codes to the terminal
// Mount Routes
app.use('/api/v1/admin/auth', adminAuth_routes_1.default);
app.use('/api/v1/admin/content', content_routes_1.default); // Mount content routes under /api/v1/admin
app.use('/api/v1/admin/questions', question_routes_1.default); // <-- Mount Question routes
app.use('/api/v1/admin/dashboard', dashboard_routes_1.default); // <-- Mount Dashboard
app.use('/api/v1/admin/users', user_routes_1.default); // <-- Mount Users
app.use('/api/v1/admin/current-affairs', currentAffairs_routes_1.default); // <-- Mount Current Affairs
app.use('/api/v1/admin/study', study_routes_1.default); // <-- Mount Admin Study Routes
app.use('/api/v1/admin/moderation', moderation_routes_1.default); // <-- Mount Moderation Routes
app.use('/api/v1/admin/gamification', gamification_routes_1.default); // <-- Mount Gamification Routes
app.use('/api/v1/admin/audit', audit_routes_1.default);
app.use('/api/v1/admin/plans', plan_routes_1.default); // <-- Mount Plan Management Routes
app.use('/api/v1/admin/financial', financial_routes_1.default); // <-- Mount Financial Routes
app.use('/api/v1/admin/coupons', coupon_routes_1.default);
app.use('/api/v1/admin/notifications', notification_routes_1.default);
app.use('/api/v1/auth', auth_routes_1.default);
app.use('/api/v1/student/tests', test_routes_1.default); // <-- Mount Student Routes
app.use('/api/v1/student/dashboard', dashboard_routes_2.default); // <-- Mount Student Dashboard Routes
app.use('/api/v1/student/analysis', analysis_routes_1.default);
app.use('/api/v1/student/gamification', gamification_routes_2.default);
app.use('/api/v1/student/study', study_routes_2.default);
app.use('/api/v1/student/articles', currentAffairs_routes_2.default);
app.use('/api/v1/student/social', social_routes_1.default);
app.use('/api/v1/student/premium', premium_routes_1.default);
app.use('/api/v1/student/utilities', utility_routes_1.default);
app.use('/api/v1/student/home', home_routes_1.default);
app.use('/api/v1/student/notifications', notification_routes_2.default);
app.use('/api/v1/onboarding', onboarding_routes_1.default);
// Health Check Route
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'Agni Shiksha API is running', timestamp: new Date() });
});
(0, newsAggregator_1.initCronJobs)(); // Start the background jobs for news aggregation
(0, premiumExperier_1.schedulePremiumExpirer)(); // Start the cron job to expire premium subscriptions
// Initialize Server
const startServer = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Initialize Redis first using the dynamic multi-provider setup
        yield (0, redis_1.initializeRedis)();
        (0, firebase_1.default)();
        // Start Express only after Redis successfully connects
        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
});
startServer();
