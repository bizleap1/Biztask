import { Response } from 'express';
import prisma from '../prismaClient';
import { AuthRequest } from '../middleware/authMiddleware';
import { z } from 'zod';

const itemSchema = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().min(0),
  taxRate: z.coerce.number().min(0).max(100).default(0)
});
const invoiceSchema = z.object({
  clientId: z.coerce.number().int().positive(),
  dueDate: z.string().datetime(),
  items: z.array(itemSchema).min(1)
});

export const getInvoices = async (_req: AuthRequest, res: Response) => {
  try {
    const invoices = await prisma.invoice.findMany({
      include: { client: { select: { id: true, name: true } }, items: true, receipts: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(invoices);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error loading invoices' });
  }
};

export const createInvoice = async (req: AuthRequest, res: Response) => {
  try {
    const parsed = invoiceSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid invoice' });
    const data = parsed.data;
    let subtotal = 0;
    const items = data.items.map(item => {
      const lineTotal = item.quantity * item.unitPrice;
      subtotal += lineTotal;
      return { ...item, lineTotal };
    });
    const cgstAmount = items.reduce((sum, item) => sum + (item.lineTotal * item.taxRate / 200), 0);
    const sgstAmount = cgstAmount;
    const totalAmount = subtotal + cgstAmount + sgstAmount;

    const year = new Date().getUTCFullYear();
    const sequence = await prisma.invoice.count({ where: { invoiceNumber: { contains: '/' + year + '/' } } });
    const invoiceNumber = 'BL-' + String(sequence + 1).padStart(4, '0') + '/' + year;
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        clientId: data.clientId,
        dueDate: new Date(data.dueDate),
        subtotal,
        cgstAmount,
        sgstAmount,
        totalAmount,
        snapshot: { items, subtotal, cgstAmount, sgstAmount, totalAmount },
        createdById: req.user!.id,
        items: { create: items }
      },
      include: { items: true, client: true, receipts: true }
    });
    res.status(201).json(invoice);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating invoice' });
  }
};

export const issueInvoice = async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.invoice.findUnique({ where: { id }, include: { items: true } });
    if (!existing) return res.status(404).json({ message: 'Invoice not found' });
    if (existing.status !== 'Draft') return res.status(409).json({ message: 'Invoice has already been issued or is not editable' });
    const snapshot = existing.snapshot || {
      items: existing.items,
      subtotal: existing.subtotal,
      cgstAmount: existing.cgstAmount,
      sgstAmount: existing.sgstAmount,
      totalAmount: existing.totalAmount
    };
    const invoice = await prisma.invoice.update({
      where: { id },
      data: { status: 'Issued', issuedAt: new Date(), snapshot }
    });
    res.json(invoice);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error issuing invoice' });
  }
};

export const addReceipt = async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: 'Receipt amount must be positive' });
    const invoice = await prisma.invoice.findUnique({ where: { id }, include: { receipts: true } });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (!['Issued', 'PartiallyPaid', 'Overdue'].includes(invoice.status)) return res.status(400).json({ message: 'Receipts require an issued invoice' });
    const paid = Number(invoice.amountPaid) + amount;
    const total = Number(invoice.totalAmount);
    if (paid > total) return res.status(400).json({ message: 'Receipt would exceed invoice total' });
    const result = await prisma.$transaction(async tx => {
      const count = await tx.receipt.count();
      const receipt = await tx.receipt.create({
        data: {
          invoiceId: id,
          amount,
          receiptNumber: `RCPT-${String(count + 1).padStart(6, '0')}`,
          receivedAt: req.body.receivedAt ? new Date(req.body.receivedAt) : new Date(),
          method: req.body.method || 'Bank',
          reference: req.body.reference || null,
          notes: req.body.notes || null,
          createdById: req.user!.id
        }
      });
      await tx.invoice.update({
        where: { id },
        data: { amountPaid: paid, status: paid >= total ? 'Paid' : 'PartiallyPaid' }
      });
      return receipt;
    });
    res.status(201).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error recording receipt' });
  }
};
