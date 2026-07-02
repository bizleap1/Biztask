import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'bizleap-proofs';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. File uploads will fail.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export const uploadFileToSupabase = async (fileBuffer: Buffer, originalName: string, mimeType: string): Promise<{ url: string, path: string }> => {
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

  // Get public URL
  const { data: publicUrlData } = supabase.storage
    .from(bucketName)
    .getPublicUrl(filePath);

  return {
    url: publicUrlData.publicUrl,
    path: filePath
  };
};
