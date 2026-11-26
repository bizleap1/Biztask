import { Response } from 'express';
import { z } from 'zod';
import prisma from '../prismaClient';
import { AuthRequest } from '../middleware/authMiddleware';
import { createActivityLog } from '../utils/activityLogUtils';

const stages = ['New', 'Contacted', 'Proposal', 'Negotiation', 'Won', 'Lost'] as const;

const leadSchema = z.object({
  name: z.string().min(2),
  companyName: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal('').transform(() => undefined)).nullable(),
  phone: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  stage: z.enum(stages).optional(),
  dealValue: z.coerce.number().min(0).optional(),
  expectedRevenue: z.coerce.number().min(0).optional(),
  ownerId: z.coerce.number().int().positive().optional(),
  campaignId: z.coerce.number().int().positive().optional().nullable(),
  nextFollowUpAt: z.string().datetime().optional().nullable(),
  lostReason: z.string().optional().nullable()
});

const activitySchema = z.object({
  type: z.enum(['Call', 'Email', 'Meeting', 'Proposal', 'Note']).default('Note'),
  subject: z.string().min(2),
  notes: z.string().optional().nullable(),
  outcome: z.string().optional().nullable(),
  followUpAt: z.string().datetime().optional().nullable()
});

export const getLeads = async (req: AuthRequest, res: Response) => {
  try {
    const where: any = { isDeleted: false };
    if (req.query.stage) where.stage = String(req.query.stage);
    if (req.query.ownerId) where.ownerId = Number(req.query.ownerId);
    if (req.user!.role !== 'SuperAdmin' && req.query.all !== 'true') where.ownerId = req.user!.id;
    const leads = await prisma.lead.findMany({
      where,
      include: {
        owner: { select: { id: true, name: true, email: true } },
        campaign: { select: { id: true, name: true, source: true } },
        activities: { orderBy: { createdAt: 'desc' }, take: 5 },
        deal: true
      },
      orderBy: [{ nextFollowUpAt: 'asc' }, { createdAt: 'desc' }]
    });
    res.json(leads);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error loading leads' });
  }
};

export const getLeadById = async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const lead = await prisma.lead.findFirst({
      where: { id, isDeleted: false },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        campaign: true,
        activities: { include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } },
        deal: true
      }
    });
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    res.json(lead);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error loading lead' });
  }
};

export const createLead = async (req: AuthRequest, res: Response) => {
  try {
    const parsed = leadSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid lead' });
    const data = parsed.data;
    const lead = await prisma.lead.create({
      data: {
        name: data.name,
        companyName: data.companyName ?? null,
        email: data.email ?? null,
        phone: data.phone ?? null,
        source: data.source ?? null,
        stage: data.stage || 'New',
        dealValue: data.dealValue || 0,
        expectedRevenue: data.expectedRevenue || 0,
        ownerId: data.ownerId || req.user!.id,
        campaignId: data.campaignId ?? null,
        nextFollowUpAt: data.nextFollowUpAt ? new Date(data.nextFollowUpAt) : null,
        lostReason: data.lostReason ?? null
      }
    });
    await createActivityLog({ userId: req.user!.id, action: 'LEAD_CREATED', entityType: 'Lead', entityId: lead.id, description: `Created lead: ${lead.name}`, req });
    res.status(201).json(lead);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating lead' });
  }
};

export const updateLead = async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.lead.findFirst({ where: { id, isDeleted: false } });
    if (!existing) return res.status(404).json({ message: 'Lead not found' });
    if (req.user!.role !== 'SuperAdmin' && existing.ownerId !== req.user!.id) {
      return res.status(403).json({ message: 'Only the lead owner or SuperAdmin can update this lead' });
    }
    const parsed = leadSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid lead' });
    const data = parsed.data;
    const lead = await prisma.lead.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.companyName !== undefined && { companyName: data.companyName }),
        ...(data.email !== undefined && { email: data.email ?? null }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.source !== undefined && { source: data.source }),
        ...(data.stage !== undefined && { stage: data.stage }),
        ...(data.dealValue !== undefined && { dealValue: data.dealValue }),
        ...(data.expectedRevenue !== undefined && { expectedRevenue: data.expectedRevenue }),
        ...(data.ownerId !== undefined && { ownerId: data.ownerId }),
        ...(data.campaignId !== undefined && { campaignId: data.campaignId }),
        ...(data.nextFollowUpAt !== undefined && { nextFollowUpAt: data.nextFollowUpAt ? new Date(data.nextFollowUpAt) : null }),
        ...(data.lostReason !== undefined && { lostReason: data.lostReason })
      }
    });
    await createActivityLog({ userId: req.user!.id, action: 'LEAD_UPDATED', entityType: 'Lead', entityId: id, description: `Updated lead stage/details: ${lead.name}`, req });
    res.json(lead);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating lead' });
  }
};

export const addLeadActivity = async (req: AuthRequest, res: Response) => {
  try {
    const leadId = Number(req.params.id);
    const lead = await prisma.lead.findFirst({ where: { id: leadId, isDeleted: false } });
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    const parsed = activitySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid activity' });
    const data = parsed.data;
    const activity = await prisma.leadActivity.create({
      data: {
        leadId,
        userId: req.user!.id,
        type: data.type,
        subject: data.subject,
        notes: data.notes ?? null,
        outcome: data.outcome ?? null,
        followUpAt: data.followUpAt ? new Date(data.followUpAt) : null
      }
    });
    await prisma.lead.update({
      where: { id: leadId },
      data: { nextFollowUpAt: data.followUpAt ? new Date(data.followUpAt) : lead.nextFollowUpAt }
    });
    res.status(201).json(activity);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error adding lead activity' });
  }
};

export const convertLead = async (req: AuthRequest, res: Response) => {
  try {
    const leadId = Number(req.params.id);
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, isDeleted: false },
      include: { activities: true, deal: true }
    });
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    if (lead.stage !== 'Won') return res.status(400).json({ message: 'Only a Won lead can be converted' });
    if (lead.deal) return res.status(409).json({ message: 'Lead already converted', clientId: lead.deal.clientId });

    const result = await prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          name: lead.companyName || lead.name,
          companyName: lead.companyName || null,
          email: lead.email || null,
          phone: lead.phone || null,
          accountManagerId: lead.ownerId,
          status: 'Active'
        }
      });
      const deal = await tx.deal.create({
        data: {
          leadId: lead.id,
          clientId: client.id,
          ownerId: lead.ownerId,
          campaignId: lead.campaignId,
          dealValue: lead.dealValue,
          revenue: lead.expectedRevenue,
          collectedAmount: 0,
          status: 'Won'
        }
      });
      await tx.lead.update({ where: { id: lead.id }, data: { convertedClientId: client.id } });
      return { client, deal };
    });

    await createActivityLog({ userId: req.user!.id, action: 'LEAD_CONVERTED', entityType: 'Lead', entityId: lead.id, description: `Converted lead ${lead.name} to client ${result.client.name}`, req });
    res.status(201).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error converting lead' });
  }
};
