import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/authMiddleware';
import { createActivityLog } from '../utils/activityLogUtils';
import prisma from '../prismaClient';

const settingItemSchema = z.object({
  key: z.string().min(1, 'Setting key is required').max(100),
  value: z.string().max(2000),
  category: z.string().min(1).max(50).default('General'),
  description: z.string().max(500).optional().nullable(),
});

const bulkUpsertSchema = z.object({
  settings: z.array(settingItemSchema).min(1, 'At least one setting is required'),
});

const DEFAULT_SETTINGS = [
  { key: 'company_name', value: 'BizLeap', category: 'General', description: 'Organization display name' },
  { key: 'daily_report_reminder_time', value: '19:00', category: 'Notifications', description: 'Daily report reminder cutoff time (24h)' },
  { key: 'client_at_risk_overdue_threshold', value: '3', category: 'ClientRules', description: 'Overdue tasks count before flagging a client At-Risk' },
  { key: 'require_proof_by_default', value: 'true', category: 'General', description: 'Require task proof by default when creating tasks' },
];

export const getSettings = async (_req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.setting.findMany({ orderBy: [{ category: 'asc' }, { key: 'asc' }] });
    if (existing.length === 0) {
      return res.json(DEFAULT_SETTINGS);
    }
    res.json(existing);
  } catch (error) {
    console.error('Get Settings Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const upsertSettings = async (req: AuthRequest, res: Response) => {
  try {
    const parsed = bulkUpsertSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid settings payload' });
    }

    const updated = await prisma.$transaction(
      parsed.data.settings.map((item) =>
        prisma.setting.upsert({
          where: { key: item.key },
          update: {
            value: item.value,
            category: item.category,
            ...(item.description !== undefined && { description: item.description }),
            updatedById: req.user!.id,
          },
          create: {
            key: item.key,
            value: item.value,
            category: item.category,
            description: item.description ?? null,
            updatedById: req.user!.id,
          },
        })
      )
    );

    await createActivityLog({
      userId: req.user!.id,
      action: 'SETTINGS_UPDATED',
      entityType: 'Setting',
      description: `Updated ${updated.length} system setting(s): ${parsed.data.settings.map(s => s.key).join(', ')}`,
      req,
    });

    res.json(updated);
  } catch (error) {
    console.error('Upsert Settings Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
