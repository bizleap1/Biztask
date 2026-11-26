import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/authMiddleware';
import { createActivityLog } from '../utils/activityLogUtils';
import prisma from '../prismaClient';

const createClientSchema = z.object({
  name: z.string().min(2, 'Client name is required'),
  companyName: z.string().optional().nullable(),
  email: z.string().email('Invalid email').optional().or(z.literal('')).nullable(),
  phone: z.string().optional().nullable(),
  industry: z.string().optional().nullable(),
  status: z.enum(['Active', 'At-Risk', 'Paused', 'Churned']).default('Active'),
  accountManagerId: z.number().int().positive().optional().nullable(),
});

const updateClientSchema = createClientSchema.partial();

const contactSchema = z.object({
  name: z.string().min(2, 'Contact name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')).nullable(),
  phone: z.string().optional().nullable(),
  designation: z.string().optional().nullable(),
  isPrimary: z.boolean().default(false),
});

export const getClients = async (req: AuthRequest, res: Response) => {
  try {
    const clients = await prisma.client.findMany({
      where: { isActive: true },
      include: {
        accountManager: { select: { id: true, name: true, email: true } },
        contacts: { orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }] },
        projects: { where: { isActive: true }, select: { id: true, name: true, status: true } },
        _count: { select: { projects: true, tasks: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(clients);
  } catch (error) {
    console.error('Get Clients Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getClientById = async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: 'Invalid client ID' });

    const client = await prisma.client.findFirst({
      where: { id, isActive: true },
      include: {
        accountManager: { select: { id: true, name: true, email: true } },
        contacts: { orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }] },
        projects: {
          where: { isActive: true },
          include: { department: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        },
        memberships: {
          where: { isRevoked: false },
          include: { user: { select: { id: true, name: true, email: true, role: true } } },
        },
      },
    });

    if (!client) return res.status(404).json({ message: 'Client not found' });
    res.json(client);
  } catch (error) {
    console.error('Get Client Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createClient = async (req: AuthRequest, res: Response) => {
  try {
    const parsed = createClientSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid input' });
    }
    const data = parsed.data;

    const client = await prisma.client.create({
      data: {
        name: data.name,
        companyName: data.companyName ?? null,
        email: data.email || null,
        phone: data.phone ?? null,
        industry: data.industry ?? null,
        status: data.status,
        accountManagerId: data.accountManagerId ?? null,
      },
      include: {
        accountManager: { select: { id: true, name: true, email: true } },
        contacts: true,
        projects: true,
      },
    });

    await createActivityLog({
      userId: req.user!.id,
      action: 'CLIENT_CREATED',
      entityType: 'Client',
      entityId: client.id,
      description: `Created client: ${client.name}`,
      req,
    });

    res.status(201).json(client);
  } catch (error) {
    console.error('Create Client Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateClient = async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: 'Invalid client ID' });

    const parsed = updateClientSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid input' });
    }

    const existing = await prisma.client.findFirst({ where: { id, isActive: true } });
    if (!existing) return res.status(404).json({ message: 'Client not found' });

    const data = parsed.data;
    const updated = await prisma.client.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.companyName !== undefined && { companyName: data.companyName }),
        ...(data.email !== undefined && { email: data.email || null }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.industry !== undefined && { industry: data.industry }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.accountManagerId !== undefined && { accountManagerId: data.accountManagerId }),
      },
      include: {
        accountManager: { select: { id: true, name: true, email: true } },
        contacts: true,
        projects: { where: { isActive: true } },
      },
    });

    await createActivityLog({
      userId: req.user!.id,
      action: 'CLIENT_UPDATED',
      entityType: 'Client',
      entityId: id,
      description: `Updated client: ${updated.name}`,
      req,
    });

    res.json(updated);
  } catch (error) {
    console.error('Update Client Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteClient = async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: 'Invalid client ID' });

    const existing = await prisma.client.findFirst({ where: { id, isActive: true } });
    if (!existing) return res.status(404).json({ message: 'Client not found' });

    await prisma.client.update({ where: { id }, data: { isActive: false } });

    await createActivityLog({
      userId: req.user!.id,
      action: 'CLIENT_DELETED',
      entityType: 'Client',
      entityId: id,
      description: `Archived client: ${existing.name}`,
      req,
    });

    res.json({ message: 'Client archived successfully' });
  } catch (error) {
    console.error('Delete Client Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const addClientContact = async (req: AuthRequest, res: Response) => {
  try {
    const clientId = Number(req.params.id);
    if (isNaN(clientId)) return res.status(400).json({ message: 'Invalid client ID' });

    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid input' });
    }

    const client = await prisma.client.findFirst({ where: { id: clientId, isActive: true } });
    if (!client) return res.status(404).json({ message: 'Client not found' });

    const contact = await prisma.$transaction(async (tx) => {
      if (parsed.data.isPrimary) {
        await tx.clientContact.updateMany({ where: { clientId }, data: { isPrimary: false } });
      }
      return tx.clientContact.create({
        data: {
          clientId,
          name: parsed.data.name,
          email: parsed.data.email || null,
          phone: parsed.data.phone ?? null,
          designation: parsed.data.designation ?? null,
          isPrimary: parsed.data.isPrimary,
        },
      });
    });

    res.status(201).json(contact);
  } catch (error) {
    console.error('Add Client Contact Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteClientContact = async (req: AuthRequest, res: Response) => {
  try {
    const clientId = Number(req.params.id);
    const contactId = Number(req.params.contactId);
    if (isNaN(clientId) || isNaN(contactId)) {
      return res.status(400).json({ message: 'Invalid ID' });
    }

    const existing = await prisma.clientContact.findFirst({ where: { id: contactId, clientId } });
    if (!existing) return res.status(404).json({ message: 'Contact not found' });

    await prisma.clientContact.delete({ where: { id: contactId } });
    res.json({ message: 'Contact removed successfully' });
  } catch (error) {
    console.error('Delete Client Contact Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
