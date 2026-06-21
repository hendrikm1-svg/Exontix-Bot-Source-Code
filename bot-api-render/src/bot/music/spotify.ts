import { logger } from "../../lib/logger";

const SPOTIFY_TRACK_RE = /open\.spotify\.com\/(?:intl-[a-z]+\/)?track\/([A-Za-z0-9]+)/;
const SPOTIFY_PLAYLIST_RE = /open\.spotify\.com\/(?:intl-[a-z]+\/)?playlist\/([A-Za-z0-9]+)/;

export function isSpotifyUrl(url: string): boolean {
  return url.includes("open.spotify.com");
}

async function getSpotifyEmbedTitle(trackId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://open.spotify.com/oembed?url=https://open.spotify.com/track/${trackId}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: string };
    return data.title ?? null;
  } catch (err) {
    logger.warn({ err }, "Spotify oEmbed fehlgeschlagen");
    return null;
  }
}

export interface SpotifyTrackInfo {
  title: string;
  searchQuery: string;
}

export async function resolveSpotifyTrack(url: string): Promise<SpotifyTrackInfo | null> {
  const trackMatch = SPOTIFY_TRACK_RE.exec(url);
  if (!trackMatch) return null;

  const trackId = trackMatch[1];
  const title = await getSpotifyEmbedTitle(trackId!);
  if (!title) return null;

  return { title, searchQuery: title };
}

export async function resolveSpotifyPlaylist(url: string): Promise<string[] | null> {
  const playlistMatch = SPOTIFY_PLAYLIST_RE.exec(url);
  if (!playlistMatch) return null;

  try {
    const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: string };
    if (data.title) return [data.title];
  } catch {
    // fallback
  }
  return null;
}
