"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNotification = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const createNotification = async (params) => {
    try {
        await prisma.notification.create({
            data: {
                userId: params.userId,
                title: params.title,
                message: params.message,
                type: params.type,
                entityType: params.entityType,
                entityId: params.entityId,
            },
        });
    }
    catch (error) {
        console.error('Error creating notification:', error);
    }
};
exports.createNotification = createNotification;
