import { Request, Response } from 'express';
import { GoogleGenAI, Type, Schema } from '@google/genai';
import { z } from 'zod';

const taskAiSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().default(''),
  priority: z.enum(['Low', 'Medium', 'High']).optional().default('Medium'),
  category: z.string().optional(),
  deadline: z.string().optional(),
  clientName: z.string().optional(),
  clientDetails: z.string().optional(),
  driveLink: z.string().optional(),
  socialMediaPlatform: z.string().optional(),
  postType: z.string().optional(),
  githubRepo: z.string().optional(),
  environment: z.string().optional()
});

const calendarAiSchema = z.array(z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  platform: z.string().min(1),
  type: z.string().min(1),
  topic: z.string().min(1),
  content: z.string().min(1),
  objective: z.string().optional().default(''),
  visualIdea: z.string().optional().default('')
}));

export const parseTask = async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: 'No audio file uploaded.' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ message: 'Gemini API key is not configured.' });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const prompt = `You are an expert, highly intelligent AI assistant that converts voice commands into structured task assignments in English. 
    You are dealing with audio that may be in English, Hindi, Hinglish (a mix), or any other language, and it might have background noise or mispronunciations. 
    Please listen very carefully and focus on the semantic intent of the speaker. Do not try to translate word-for-word if it doesn't make sense; instead, extract the core task details accurately.
    If a field is not explicitly mentioned, leave it empty or choose a reasonable default based on context.
    For 'priority', choose from: 'Low', 'Medium', 'High'. Default to 'Medium'.
    For 'proofRequired', choose true or false.
    Format your response EXACTLY as the required JSON schema. Translate all content to proper, professional English.`;

    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: file.buffer.toString('base64'),
                mimeType: file.mimetype,
              },
            },
            {
              text: prompt,
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'A short, clear title for the task in English.' },
            description: { type: Type.STRING, description: 'A detailed description of what needs to be done in English.' },
            priority: { type: Type.STRING, description: 'Priority of the task (Low, Medium, High).' },
            category: { type: Type.STRING, description: 'Category of the task (e.g., Website Development, Bug Fix, Instagram Post, etc.).' },
            deadline: { type: Type.STRING, description: 'Deadline for the task, if mentioned. Format: YYYY-MM-DD. Leave empty if not mentioned.' },
            clientName: { type: Type.STRING, description: 'Name of the client, if mentioned.' },
            clientDetails: { type: Type.STRING, description: 'Details about the client, if mentioned.' },
            driveLink: { type: Type.STRING, description: 'Drive link or any URL mentioned.' },
            socialMediaPlatform: { type: Type.STRING, description: 'Social media platform (e.g. Instagram, Facebook), if mentioned.' },
            postType: { type: Type.STRING, description: 'Type of post, if mentioned.' },
            githubRepo: { type: Type.STRING, description: 'GitHub repository name, if mentioned.' },
            environment: { type: Type.STRING, description: 'Environment (e.g. Production, Staging), if mentioned.' },
          },
          required: ['title', 'description', 'priority'],
        },
      },
    });

    if (response.text) {
      const parsedData = taskAiSchema.safeParse(JSON.parse(response.text));
      if (!parsedData.success) return res.status(422).json({ message: 'AI output did not pass reviewable task validation', issues: parsedData.error.issues });
      res.json(parsedData.data);
    } else {
      res.status(500).json({ message: 'Failed to parse task from audio.' });
    }
  } catch (error: any) {
    console.error('Error parsing task from audio:', error);
    res.status(500).json({ message: error.message || 'Internal server error.' });
  }
};

export const generateCalendar = async (req: Request, res: Response) => {
  try {
    const { clientName, promotionDetails, numPosts, platforms } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ message: 'Gemini API key is not configured.' });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const prompt = `You are an expert Social Media Manager. Create a detailed content calendar for a client.
    Client/Brand: ${clientName}
    Promotion/Goal: ${promotionDetails}
    Number of posts required: ${numPosts}
    Target Platforms: ${platforms.join(', ')}
    
    Please generate ${numPosts} highly engaging posts spaced out logically.
    For the "date" field, use dates in the near future in "YYYY-MM-DD" format.
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
              type: { type: Type.STRING, description: 'Format (e.g. Reel, Carousel, Static Post)' },
              topic: { type: Type.STRING, description: 'Short catchy headline or topic for the post' },
              content: { type: Type.STRING, description: 'Detailed description of the post content' },
              objective: { type: Type.STRING, description: 'The primary goal (e.g., Build Trust, Brand Awareness)' },
              visualIdea: { type: Type.STRING, description: 'Visual idea, reference, or CTA for the post' }
            },
            required: ['date', 'platform', 'type', 'topic', 'content', 'objective', 'visualIdea']
          }
        },
      },
    });

    if (response.text) {
      const parsedData = calendarAiSchema.safeParse(JSON.parse(response.text));
      if (!parsedData.success) return res.status(422).json({ message: 'AI output did not pass calendar validation', issues: parsedData.error.issues });
      res.json(parsedData.data);
    } else {
      res.status(500).json({ message: 'Failed to generate calendar.' });
    }
  } catch (error: any) {
    console.error('Error generating calendar:', error);
    res.status(500).json({ message: error.message || 'Internal server error.' });
  }
};
