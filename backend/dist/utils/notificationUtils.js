"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNotification = void 0;
const prismaClient_1 = __importDefault(require("../prismaClient"));
const createNotification = async (params) => {
    try {
        await prismaClient_1.default.notification.create({
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
