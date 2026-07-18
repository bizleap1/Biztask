import api from './api';

export const aiService = {
  parseTaskFromAudio: async (audioBlob: Blob) => {
    const formData = new FormData();
    // Append the audio file with a specific filename and mimetype
    formData.append('audio', audioBlob, 'audio.webm');

    const response = await api.post('/ai/parse-task', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  },
};
