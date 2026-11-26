import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'bizleap-proofs';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. File uploads will fail.');
}

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export const uploadFileToSupabase = async (fileBuffer: Buffer, originalName: string, mimeType: string): Promise<{ url: string, path: string }> => {
  if (!supabase) {
    throw new Error('Supabase client is not initialized. Please configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file.');
  }
  const timestamp = Date.now();
  const safeName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const filePath = `${timestamp}-${safeName}`;

  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(filePath, fileBuffer, {
      contentType: mimeType,
      upsert: false
    });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  // Private delivery only. Public bucket URLs must never be returned.
  const { data: signedData, error: signedError } = await supabase.storage
    .from(bucketName)
    .createSignedUrl(filePath, 3600);

  if (!signedData?.signedUrl) {
    throw new Error(`Failed to create a protected signed URL: ${signedError?.message || 'Configure the storage bucket as private.'}`);
  }
  return { url: signedData.signedUrl, path: filePath };
};

export const getSignedFileUrl = async (filePath: string, expiresInSeconds = 3600): Promise<string> => {
  if (!supabase) {
    throw new Error('Supabase client is not initialized.');
  }
  const { data, error } = await supabase.storage
    .from(bucketName)
    .createSignedUrl(filePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to generate signed URL: ${error?.message || 'Unknown error'}`);
  }
  return data.signedUrl;
};
