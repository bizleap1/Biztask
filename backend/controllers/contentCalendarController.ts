/**
 * Sprint 12 — Content Calendar AI Controller (F07)
 *
 * CRUD for ContentCalendar + ContentItem.
 * AI generation (wraps existing generateCalendar AI endpoint).
 * Approve/reject items with human review gate.
 * Convert approved items to tasks.
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import prisma from '../prismaClient';
import { createActivityLog } from '../utils/activityLogUtils';
import { createNotification } from '../utils/notificationUtils';
import { GoogleGenAI, Type } from '@google/genai';

// ─── Calendars ────────────────────────────────────────────────────────────────

// @desc    List content calendars (with filters)
// @route   GET /api/content-calendars
export const getCalendars = async (req: AuthRequest, res: Response) => {
  try {
    const { clientId, month, year, status } = req.query;
    const where: Record<string, unknown> = { isDeleted: false };
    if (clientId) where.clientId = Number(clientId);
    if (month) where.month = Number(month);
    if (year) where.year = Number(year);
    if (status) where.status = String(status);

    const calendars = await prisma.contentCalendar.findMany({
      where,
      include: {
        client: { select: { id: true, name: true, companyName: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { items: true } }
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }]
    });

    res.json({ calendars });
  } catch (error) {
    console.error('Get Calendars Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get single calendar with items
// @route   GET /api/content-calendars/:id
export const getCalendarById = async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const calendar = await prisma.contentCalendar.findFirst({
      where: { id, isDeleted: false },
      include: {
        client: { select: { id: true, name: true, companyName: true } },
        createdBy: { select: { id: true, name: true } },
        items: {
          where: { isDeleted: false },
          orderBy: { scheduledDate: 'asc' },
          include: {
            task: { select: { id: true, title: true, status: true } },
            createdBy: { select: { id: true, name: true } }
          }
        }
      }
    });

    if (!calendar) return res.status(404).json({ message: 'Calendar not found' });
    res.json({ calendar });
  } catch (error) {
    console.error('Get Calendar Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Create content calendar
// @route   POST /api/content-calendars
export const createCalendar = async (req: AuthRequest, res: Response) => {
  try {
    const { title, month, year, clientId, notes } = req.body;
    if (!title || !month || !year || !clientId) {
      return res.status(400).json({ message: 'title, month, year, and clientId are required' });
    }

    // Check if calendar already exists for this client/month/year
    const existing = await prisma.contentCalendar.findUnique({
      where: { clientId_month_year: { clientId: Number(clientId), month: Number(month), year: Number(year) } }
    });
    if (existing && !existing.isDeleted) {
      return res.status(409).json({ message: 'A content calendar already exists for this client/month/year' });
    }

    const calendar = await prisma.contentCalendar.create({
      data: {
        title,
        month: Number(month),
        year: Number(year),
        clientId: Number(clientId),
        createdById: req.user!.id,
        notes: notes || null
      },
      include: {
        client: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } }
      }
    });

    await createActivityLog({
      userId: req.user!.id,
      action: 'Created Content Calendar',
      entityType: 'ContentCalendar',
      entityId: calendar.id,
      description: `Created content calendar "${title}" for ${calendar.client.name} (${month}/${year})`
    });

    res.status(201).json({ calendar });
  } catch (error) {
    console.error('Create Calendar Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update content calendar
// @route   PUT /api/content-calendars/:id
export const updateCalendar = async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { title, status, notes } = req.body;

    const existing = await prisma.contentCalendar.findFirst({ where: { id, isDeleted: false } });
    if (!existing) return res.status(404).json({ message: 'Calendar not found' });

    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title;
    if (status !== undefined) data.status = status;
    if (notes !== undefined) data.notes = notes;

    const calendar = await prisma.contentCalendar.update({
      where: { id },
      data,
      include: {
        client: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } }
      }
    });

    res.json({ calendar });
  } catch (error) {
    console.error('Update Calendar Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete content calendar (soft delete)
// @route   DELETE /api/content-calendars/:id
export const deleteCalendar = async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    await prisma.contentCalendar.update({ where: { id }, data: { isDeleted: true } });
    res.json({ message: 'Calendar deleted' });
  } catch (error) {
    console.error('Delete Calendar Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Items ────────────────────────────────────────────────────────────────────

// @desc    Add item to calendar
// @route   POST /api/content-calendars/:id/items
export const addItem = async (req: AuthRequest, res: Response) => {
  try {
    const calendarId = Number(req.params.id);
    const { scheduledDate, platform, postType, topic, content, objective, visualIdea, hashtags } = req.body;

    if (!scheduledDate || !platform || !postType || !topic || !content) {
      return res.status(400).json({ message: 'scheduledDate, platform, postType, topic, and content are required' });
    }

    const calendar = await prisma.contentCalendar.findFirst({ where: { id: calendarId, isDeleted: false } });
    if (!calendar) return res.status(404).json({ message: 'Calendar not found' });

    const item = await prisma.contentItem.create({
      data: {
        calendarId,
        scheduledDate: new Date(scheduledDate as string),
        platform: String(platform),
        postType: String(postType),
        topic: String(topic),
        content: String(content),
        objective: objective ? String(objective) : null,
        visualIdea: visualIdea ? String(visualIdea) : null,
        hashtags: hashtags ? String(hashtags) : null,
        createdById: req.user!.id
      }
    });

    res.status(201).json({ item });
  } catch (error) {
    console.error('Add Item Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update item
// @route   PUT /api/content-calendars/:calId/items/:itemId
export const updateItem = async (req: AuthRequest, res: Response) => {
  try {
    const itemId = Number(req.params.itemId);
    const { scheduledDate, platform, postType, topic, content, objective, visualIdea, hashtags, status, reviewNotes } = req.body;

    const existing = await prisma.contentItem.findFirst({ where: { id: itemId, isDeleted: false } });
    if (!existing) return res.status(404).json({ message: 'Item not found' });

    const data: Record<string, unknown> = {};
    if (scheduledDate !== undefined) data.scheduledDate = new Date(scheduledDate as string);
    if (platform !== undefined) data.platform = platform;
    if (postType !== undefined) data.postType = postType;
    if (topic !== undefined) data.topic = topic;
    if (content !== undefined) data.content = content;
    if (objective !== undefined) data.objective = objective;
    if (visualIdea !== undefined) data.visualIdea = visualIdea;
    if (hashtags !== undefined) data.hashtags = hashtags;
    if (status !== undefined) data.status = status;
    if (reviewNotes !== undefined) data.reviewNotes = reviewNotes;

    const item = await prisma.contentItem.update({ where: { id: itemId }, data });
    res.json({ item });
  } catch (error) {
    console.error('Update Item Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete item (soft)
// @route   DELETE /api/content-calendars/:calId/items/:itemId
export const deleteItem = async (req: AuthRequest, res: Response) => {
  try {
    const itemId = Number(req.params.itemId);
    await prisma.contentItem.update({ where: { id: itemId }, data: { isDeleted: true } });
    res.json({ message: 'Item deleted' });
  } catch (error) {
    console.error('Delete Item Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Approve / Reject (Human Review Gate) ─────────────────────────────────────

// @desc    Approve item
// @route   PATCH /api/content-calendars/:calId/items/:itemId/approve
export const approveItem = async (req: AuthRequest, res: Response) => {
  try {
    const itemId = Number(req.params.itemId);
    const { reviewNotes } = req.body;

    const item = await prisma.contentItem.findFirst({ where: { id: itemId, isDeleted: false } });
    if (!item) return res.status(404).json({ message: 'Item not found' });
    if (item.status === 'Approved') return res.status(400).json({ message: 'Item already approved' });

    const updated = await prisma.contentItem.update({
      where: { id: itemId },
      data: { status: 'Approved', reviewNotes: reviewNotes || null }
    });

    // Notify creator
    if (item.createdById !== req.user!.id) {
      await createNotification({
        userId: item.createdById,
        title: 'Content Item Approved',
        message: `Your content item "${item.topic}" has been approved.`,
        type: 'content_approved',
        entityType: 'ContentItem',
        entityId: item.id
      });
    }

    res.json({ item: updated });
  } catch (error) {
    console.error('Approve Item Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Reject item
// @route   PATCH /api/content-calendars/:calId/items/:itemId/reject
export const rejectItem = async (req: AuthRequest, res: Response) => {
  try {
    const itemId = Number(req.params.itemId);
    const { reviewNotes } = req.body;

    const item = await prisma.contentItem.findFirst({ where: { id: itemId, isDeleted: false } });
    if (!item) return res.status(404).json({ message: 'Item not found' });

    const updated = await prisma.contentItem.update({
      where: { id: itemId },
      data: { status: 'Rejected', reviewNotes: reviewNotes || 'Rejected by reviewer' }
    });

    if (item.createdById !== req.user!.id) {
      await createNotification({
        userId: item.createdById,
        title: 'Content Item Rejected',
        message: `Your content item "${item.topic}" was rejected: ${reviewNotes || 'No reason given'}.`,
        type: 'content_rejected',
        entityType: 'ContentItem',
        entityId: item.id
      });
    }

    res.json({ item: updated });
  } catch (error) {
    console.error('Reject Item Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Convert to Task ──────────────────────────────────────────────────────────

// @desc    Convert approved content item to a Task
// @route   POST /api/content-calendars/:calId/items/:itemId/convert-to-task
export const convertToTask = async (req: AuthRequest, res: Response) => {
  try {
    const itemId = Number(req.params.itemId);
    const { assignedToId, departmentId, priority } = req.body;

    const item = await prisma.contentItem.findFirst({
      where: { id: itemId, isDeleted: false },
      include: { calendar: { include: { client: true } } }
    });

    if (!item) return res.status(404).json({ message: 'Item not found' });
    if (item.status !== 'Approved') return res.status(400).json({ message: 'Only approved items can be converted to tasks' });
    if (item.taskId) return res.status(400).json({ message: 'Item already converted to a task' });

    if (!departmentId) return res.status(400).json({ message: 'departmentId is required' });

    const task = await prisma.task.create({
      data: {
        title: `[Content] ${item.topic}`,
        description: `${item.content}\n\nPlatform: ${item.platform}\nType: ${item.postType}${item.visualIdea ? `\nVisual Idea: ${item.visualIdea}` : ''}${item.hashtags ? `\nHashtags: ${item.hashtags}` : ''}`,
        category: 'Content Calendar',
        priority: priority || 'Medium',
        deadline: item.scheduledDate,
        proofRequired: true,
        proofType: 'Social Media Link',
        clientId: item.calendar.clientId,
        clientName: item.calendar.client?.name || null,
        socialMediaPlatform: item.platform,
        postType: item.postType,
        departmentId: Number(departmentId),
        assignedToId: assignedToId ? Number(assignedToId) : null,
        assignedById: req.user!.id
      }
    });

    await prisma.contentItem.update({
      where: { id: itemId },
      data: { status: 'ConvertedToTask', taskId: task.id }
    });

    await createActivityLog({
      userId: req.user!.id,
      action: 'Converted Content Item to Task',
      entityType: 'Task',
      entityId: task.id,
      description: `Converted content item "${item.topic}" to task #${task.id}`
    });

    if (assignedToId) {
      await createNotification({
        userId: Number(assignedToId),
        title: 'New Content Task Assigned',
        message: `You have been assigned a content task: "${item.topic}" for ${item.calendar.client?.name || 'client'}.`,
        type: 'task_assigned',
        entityType: 'Task',
        entityId: task.id
      });
    }

    res.status(201).json({ task, item: { id: itemId, status: 'ConvertedToTask', taskId: task.id } });
  } catch (error) {
    console.error('Convert to Task Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── AI Generate Items ────────────────────────────────────────────────────────

// @desc    Generate content items using AI for a calendar
// @route   POST /api/content-calendars/:id/generate
export const generateItems = async (req: AuthRequest, res: Response) => {
  try {
    const calendarId = Number(req.params.id);
    const { numPosts, platforms, promotionDetails } = req.body;

    if (!numPosts || !platforms || platforms.length === 0) {
      return res.status(400).json({ message: 'numPosts and platforms are required' });
    }

    const calendar = await prisma.contentCalendar.findFirst({
      where: { id: calendarId, isDeleted: false },
      include: { client: true }
    });
    if (!calendar) return res.status(404).json({ message: 'Calendar not found' });

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ message: 'Gemini API key is not configured.' });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const monthName = monthNames[(calendar.month - 1)] || `Month ${calendar.month}`;

    const prompt = `You are an expert Social Media Manager. Create a detailed content calendar for a client.
Client/Brand: ${calendar.client.name}${calendar.client.companyName ? ` (${calendar.client.companyName})` : ''}
Month: ${monthName} ${calendar.year}
Promotion/Goal: ${promotionDetails || 'General brand awareness and engagement'}
Number of posts required: ${numPosts}
Target Platforms: ${(platforms as string[]).join(', ')}

Please generate ${numPosts} highly engaging posts spaced out logically across ${monthName} ${calendar.year}.
For the "date" field, use dates within ${monthName} ${calendar.year} in "YYYY-MM-DD" format.
Format your response EXACTLY as the required JSON schema.`;

    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              date: { type: Type.STRING, description: 'YYYY-MM-DD' },
              platform: { type: Type.STRING, description: 'The social media platform' },
              type: { type: Type.STRING, description: 'Format (e.g. Reel, Carousel, Static Post, Story, Video, Blog)' },
              topic: { type: Type.STRING, description: 'Short catchy headline or topic for the post' },
              content: { type: Type.STRING, description: 'Detailed description of the post content' },
              objective: { type: Type.STRING, description: 'The primary goal (e.g., Build Trust, Brand Awareness)' },
              visualIdea: { type: Type.STRING, description: 'Visual idea, reference, or CTA for the post' },
              hashtags: { type: Type.STRING, description: 'Recommended hashtags' }
            },
            required: ['date', 'platform', 'type', 'topic', 'content', 'objective', 'visualIdea']
          }
        },
      },
    });

    if (!response.text) {
      return res.status(500).json({ message: 'AI did not return a response' });
    }

    const aiItems = JSON.parse(response.text) as Array<{
      date: string; platform: string; type: string; topic: string;
      content: string; objective: string; visualIdea: string; hashtags?: string;
    }>;

    // Save all AI items to the database in Draft status
    const createdItems = [];
    for (const ai_item of aiItems) {
      const item = await prisma.contentItem.create({
        data: {
          calendarId,
          scheduledDate: new Date(ai_item.date),
          platform: ai_item.platform,
          postType: ai_item.type,
          topic: ai_item.topic,
          content: ai_item.content,
          objective: ai_item.objective || null,
          visualIdea: ai_item.visualIdea || null,
          hashtags: ai_item.hashtags || null,
          createdById: req.user!.id,
          aiGenerated: true
        }
      });
      createdItems.push(item);
    }

    await createActivityLog({
      userId: req.user!.id,
      action: 'AI Generated Content Items',
      entityType: 'ContentCalendar',
      entityId: calendarId,
      description: `Generated ${createdItems.length} AI content items for calendar #${calendarId}`
    });

    res.status(201).json({
      message: `Generated ${createdItems.length} content items (Draft status — review before approving)`,
      items: createdItems
    });
  } catch (error) {
    console.error('Generate Items Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Export (PDF-ready JSON) ──────────────────────────────────────────────────

// @desc    Get calendar data formatted for PDF/PNG export
// @route   GET /api/content-calendars/:id/export
export const exportCalendar = async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const calendar = await prisma.contentCalendar.findFirst({
      where: { id, isDeleted: false },
      include: {
        client: { select: { id: true, name: true, companyName: true } },
        createdBy: { select: { id: true, name: true } },
        items: {
          where: { isDeleted: false },
          orderBy: { scheduledDate: 'asc' }
        }
      }
    });

    if (!calendar) return res.status(404).json({ message: 'Calendar not found' });

    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    const exportData = {
      title: calendar.title,
      client: calendar.client.name,
      company: calendar.client.companyName || '',
      period: `${monthNames[(calendar.month - 1)] || calendar.month} ${calendar.year}`,
      status: calendar.status,
      createdBy: calendar.createdBy.name,
      notes: calendar.notes || '',
      totalItems: calendar.items.length,
      items: calendar.items.map(item => ({
        date: item.scheduledDate.toISOString().split('T')[0],
        platform: item.platform,
        type: item.postType,
        topic: item.topic,
        content: item.content,
        objective: item.objective || '',
        visualIdea: item.visualIdea || '',
        hashtags: item.hashtags || '',
        status: item.status,
        aiGenerated: item.aiGenerated
      })),
      exportedAt: new Date().toISOString()
    };

    res.json({ export: exportData });
  } catch (error) {
    console.error('Export Calendar Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
