"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createActivityLog = void 0;
const prismaClient_1 = __importDefault(require("../prismaClient"));
const createActivityLog = async (params) => {
    try {
        const ipAddress = params.req?.ip || params.req?.connection?.remoteAddress || null;
        const userAgent = params.req?.headers['user-agent'] || null;
        await prismaClient_1.default.activityLog.create({
            data: {
                userId: params.userId,
                action: params.action,
                entityType: params.entityType,
                entityId: params.entityId,
                description: params.description,
                metadata: params.metadata ? JSON.stringify(params.metadata) : null,
                ipAddress,
                userAgent,
            },
        });
    }
    catch (error) {
        console.error('Error creating activity log:', error);
    }
};
exports.createActivityLog = createActivityLog;
