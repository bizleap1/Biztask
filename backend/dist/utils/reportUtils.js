"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateMonthlyReportRate = void 0;
const prismaClient_1 = __importDefault(require("../prismaClient"));
const calculateMonthlyReportRate = async (userId) => {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    let workdaysElapsed = 0;
    for (let d = new Date(firstDayOfMonth); d <= now; d.setDate(d.getDate() + 1)) {
        if (d.getDay() !== 0 && d.getDay() !== 6) {
            workdaysElapsed++;
        }
    }
    if (workdaysElapsed === 0)
        workdaysElapsed = 1; // Prevent division by zero
    const reportsThisMonth = await prismaClient_1.default.dailyReport.count({
        where: {
            userId,
            reportDate: { gte: firstDayOfMonth }
        }
    });
    return Math.min(100, (reportsThisMonth / workdaysElapsed) * 100).toFixed(1);
};
exports.calculateMonthlyReportRate = calculateMonthlyReportRate;
