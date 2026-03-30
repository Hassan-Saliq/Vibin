import { createClient } from '@supabase/supabase-js';
import { localTracks } from './data';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const adminEmail = import.meta.env.VITE_ADMIN_EMAIL?.trim().toLowerCase() || '';

export const supabase =
  supabaseUrl && supabasePublishableKey
    ? createClient(supabaseUrl, supabasePublishableKey)
    : null;

function normalizeTrack(row) {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist || 'Personal Track',
    duration: row.duration || 0,
    cover: row.cover_url,
    src: row.audio_url,
    blurb: row.blurb || 'A track from your collection.',
  };
}

export async function loadTracks() {
  if (!supabase) {
    return localTracks;
  }

  const { data, error } = await supabase
    .from('songs')
    .select('id, title, artist, duration, cover_url, audio_url, blurb')
    .order('created_at', { ascending: true });

  if (error || !data?.length) {
    return localTracks;
  }

  return data.map(normalizeTrack);
}

export function isAdminUser(user) {
  if (!user) {
    return false;
  }

  if (!adminEmail) {
    return true;
  }

  return user.email?.toLowerCase() === adminEmail;
}

export function extractStoragePath(publicUrl) {
  if (!publicUrl) {
    return '';
  }

  const marker = '/object/public/';
  const markerIndex = publicUrl.indexOf(marker);
  if (markerIndex === -1) {
    return '';
  }

  return publicUrl.slice(markerIndex + marker.length).split('/').slice(1).join('/');
}
