import { Request } from 'express';

import prisma from '../prismaClient';

interface CreateActivityLogParams {
  userId: number;
  action: string;
  entityType?: string;
  entityId?: number;
  description?: string;
  metadata?: any;
  req?: Request;
}

export const createActivityLog = async (params: CreateActivityLogParams) => {
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
  } catch (error) {
    console.error('Error creating activity log:', error);
  }
};
