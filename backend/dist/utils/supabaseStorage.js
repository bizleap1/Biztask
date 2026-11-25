"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSignedFileUrl = exports.uploadFileToSupabase = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'bizleap-proofs';
if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials. File uploads will fail.');
}
const supabase = supabaseUrl && supabaseKey ? (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey) : null;
const uploadFileToSupabase = async (fileBuffer, originalName, mimeType) => {
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
    // Prefer short-lived signed URL for private buckets; fallback to public URL if bucket is public
    const { data: signedData } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(filePath, 3600);
    if (signedData?.signedUrl) {
        return {
            url: signedData.signedUrl,
            path: filePath
        };
    }
    const { data: publicUrlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);
    return {
        url: publicUrlData.publicUrl,
        path: filePath
    };
};
exports.uploadFileToSupabase = uploadFileToSupabase;
const getSignedFileUrl = async (filePath, expiresInSeconds = 3600) => {
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
exports.getSignedFileUrl = getSignedFileUrl;
