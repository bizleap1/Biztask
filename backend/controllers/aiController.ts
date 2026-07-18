import { Request, Response } from 'express';
import { GoogleGenAI, Type, Schema } from '@google/genai';

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
      const parsedData = JSON.parse(response.text);
      res.json(parsedData);
    } else {
      res.status(500).json({ message: 'Failed to parse task from audio.' });
    }
  } catch (error: any) {
    console.error('Error parsing task from audio:', error);
    res.status(500).json({ message: error.message || 'Internal server error.' });
  }
};
