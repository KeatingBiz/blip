// lib/storage.ts
import { supabaseAdmin } from './supabaseAdmin';

export async function saveAudioBuffer(filename: string, buffer: Buffer) {
  const bucket = process.env.SUPABASE_BUCKET || 'blip';

  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(filename, buffer, {
      contentType: 'audio/mpeg',
      upsert: true,
    });

  if (error) throw error;

  const { data } = await supabaseAdmin.storage.from(bucket).getPublicUrl(filename);
  return data.publicUrl as string;
}
