"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const taskRoutes_1 = __importDefault(require("./routes/taskRoutes"));
const submissionRoutes_1 = __importDefault(require("./routes/submissionRoutes"));
const dailyReportRoutes_1 = __importDefault(require("./routes/dailyReportRoutes"));
const dashboardRoutes_1 = __importDefault(require("./routes/dashboardRoutes"));
const notificationRoutes_1 = __importDefault(require("./routes/notificationRoutes"));
const activityLogRoutes_1 = __importDefault(require("./routes/activityLogRoutes"));
const uploadRoutes_1 = __importDefault(require("./routes/uploadRoutes"));
const systemRoutes_1 = __importDefault(require("./routes/systemRoutes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
app.use((0, cors_1.default)({
    origin: process.env.NODE_ENV === 'production' ? frontendUrl : true,
    credentials: true
}));
app.use(express_1.default.json());
// Base health route
app.get('/', (req, res) => {
    res.send('BizLeap API is running');
});
// Basic health check route
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'BizLeap API is running' });
});
app.use('/api/auth', authRoutes_1.default);
app.use('/api/users', userRoutes_1.default);
app.use('/api/tasks', taskRoutes_1.default);
app.use('/api/submissions', submissionRoutes_1.default);
app.use('/api/daily-reports', dailyReportRoutes_1.default);
app.use('/api/dashboard', dashboardRoutes_1.default);
app.use('/api/notifications', notificationRoutes_1.default);
app.use('/api/activity-logs', activityLogRoutes_1.default);
app.use('/api/upload', uploadRoutes_1.default);
app.use('/api/system', systemRoutes_1.default);
// Other routes will be added later
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}
exports.default = app;
