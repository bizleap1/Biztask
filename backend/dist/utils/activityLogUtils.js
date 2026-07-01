"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createActivityLog = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const createActivityLog = async (params) => {
    try {
        const ipAddress = params.req?.ip || params.req?.connection?.remoteAddress || null;
        const userAgent = params.req?.headers['user-agent'] || null;
        await prisma.activityLog.create({
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
