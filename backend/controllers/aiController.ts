import { Request, Response } from 'express';
import { z } from 'zod';

const callGeminiJson = async (prompt: string, inlineData?: { mimeType: string; data: string }) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API key is not configured.');
  const parts: Array<Record<string, unknown>> = [{ text: prompt }];
  if (inlineData) parts.unshift({ inlineData });
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    }
  );
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Gemini request failed (${response.status}): ${details}`);
  }
  const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = payload.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || '';
  if (!text) throw new Error('Gemini returned no text.');
  return JSON.parse(text);
};

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

    const prompt = `You are an expert, highly intelligent AI assistant that converts voice commands into structured task assignments in English. 
    You are dealing with audio that may be in English, Hindi, Hinglish (a mix), or any other language, and it might have background noise or mispronunciations. 
    Please listen very carefully and focus on the semantic intent of the speaker. Do not try to translate word-for-word if it doesn't make sense; instead, extract the core task details accurately.
    If a field is not explicitly mentioned, leave it empty or choose a reasonable default based on context.
    For 'priority', choose from: 'Low', 'Medium', 'High'. Default to 'Medium'.
    For 'proofRequired', choose true or false.
    Format your response EXACTLY as the required JSON schema. Translate all content to proper, professional English.`;

    const parsedData = taskAiSchema.safeParse(await callGeminiJson(prompt, {
      data: file.buffer.toString('base64'),
      mimeType: file.mimetype
    }));
    if (!parsedData.success) return res.status(422).json({ message: 'AI output did not pass reviewable task validation', issues: parsedData.error.issues });
    res.json(parsedData.data);
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

    const prompt = `You are an expert Social Media Manager. Create a detailed content calendar for a client.
    Client/Brand: ${clientName}
    Promotion/Goal: ${promotionDetails}
    Number of posts required: ${numPosts}
    Target Platforms: ${platforms.join(', ')}
    
    Please generate ${numPosts} highly engaging posts spaced out logically.
    For the "date" field, use dates in the near future in "YYYY-MM-DD" format.
    Format your response EXACTLY as the required JSON schema.`;

    const parsedData = calendarAiSchema.safeParse(await callGeminiJson(prompt));
    if (!parsedData.success) return res.status(422).json({ message: 'AI output did not pass calendar validation', issues: parsedData.error.issues });
    res.json(parsedData.data);
  } catch (error: any) {
    console.error('Error generating calendar:', error);
    res.status(500).json({ message: error.message || 'Internal server error.' });
  }
};
