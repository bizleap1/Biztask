import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CreateNotificationParams {
  userId: number;
  title: string;
  message: string;
  type: string;
  entityType?: string;
  entityId?: number;
}

export const createNotification = async (params: CreateNotificationParams) => {
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
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};
