import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  StreamType,
} from "@discordjs/voice";
import type { VoiceBasedChannel, TextBasedChannel } from "discord.js";
import { EmbedBuilder } from "discord.js";
import ytdl from "@distube/ytdl-core";
import { YouTube } from "youtube-sr";
import { getQueue, setQueue, deleteQueue, type GuildQueue, type Track } from "./queue";
import { logger } from "../../lib/logger";
import { isSpotifyUrl, resolveSpotifyTrack } from "./spotify";

export async function searchTracks(query: string): Promise<Track[]> {
  try {
    // Spotify URL → resolve to YouTube search
    if (isSpotifyUrl(query)) {
      const spotifyInfo = await resolveSpotifyTrack(query);
      if (!spotifyInfo) {
        logger.warn({ query }, "Spotify-Track konnte nicht aufgelöst werden");
        return [];
      }
      // Search YouTube with the Spotify track title
      const results = await YouTube.search(spotifyInfo.searchQuery, { limit: 1, type: "video" });
      return results.map((v) => ({
        title: spotifyInfo.title,
        url: `https://www.youtube.com/watch?v=${v.id}`,
        duration: formatDuration(v.duration ? Math.floor(v.duration / 1000) : 0),
        thumbnail: v.thumbnail?.url ?? null,
        requestedBy: "",
      }));
    }

    // Direct YouTube URL
    if (ytdl.validateURL(query)) {
      const info = await ytdl.getInfo(query);
      const details = info.videoDetails;
      return [
        {
          title: details.title,
          url: details.video_url,
          duration: formatDuration(parseInt(details.lengthSeconds, 10)),
          thumbnail: details.thumbnails[details.thumbnails.length - 1]?.url ?? null,
          requestedBy: "",
        },
      ];
    }

    // Text search on YouTube
    const results = await YouTube.search(query, { limit: 5, type: "video" });
    return results.map((v) => ({
      title: v.title ?? "Unbekannt",
      url: `https://www.youtube.com/watch?v=${v.id}`,
      duration: formatDuration(v.duration ? Math.floor(v.duration / 1000) : 0),
      thumbnail: v.thumbnail?.url ?? null,
      requestedBy: "",
    }));
  } catch (err) {
    logger.error({ err, query }, "Suche fehlgeschlagen");
    return [];
  }
}

async function createStream(url: string) {
  try {
    const info = await ytdl.getInfo(url);
    const opusFormat = ytdl.chooseFormat(info.formats, {
      filter: (f) => f.codecs === "opus" && f.container === "webm",
      quality: "highestaudio",
    });
    if (opusFormat) {
      const stream = ytdl.downloadFromInfo(info, { format: opusFormat, highWaterMark: 1 << 25 });
      return { stream, type: StreamType.WebmOpus };
    }
  } catch {
    // No opus format — fall through
  }

  const stream = ytdl(url, { filter: "audioonly", quality: "highestaudio", highWaterMark: 1 << 25 });
  return { stream, type: StreamType.Arbitrary };
}

export async function playTrack(guildId: string, track: Track): Promise<void> {
  const queue = getQueue(guildId);
  if (!queue) return;

  try {
    const { stream, type } = await createStream(track.url);
    const resource = createAudioResource(stream, { inputType: type });
    queue.player.play(resource);
    queue.current = track;
  } catch (err) {
    logger.error({ err, track: track.title }, "Fehler beim Abspielen");
    const q = getQueue(guildId);
    if (q && q.tracks.length > 0) {
      await playTrack(guildId, q.tracks.shift()!);
    } else if (q) {
      q.current = null;
    }
  }
}

export async function joinAndPlay(
  guildId: string,
  voiceChannel: VoiceBasedChannel,
  _textChannel: TextBasedChannel,
  track: Track,
): Promise<GuildQueue> {
  let queue = getQueue(guildId);

  if (!queue) {
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    });

    await entersState(connection, VoiceConnectionStatus.Ready, 30_000);

    const player = createAudioPlayer();
    connection.subscribe(player);

    queue = {
      tracks: [],
      current: null,
      connection,
      player,
      textChannelId: _textChannel.id,
      volume: 100,
      loop: false,
    };
    setQueue(guildId, queue);

    player.on(AudioPlayerStatus.Idle, async () => {
      const q = getQueue(guildId);
      if (!q) return;

      if (q.loop && q.current) {
        await playTrack(guildId, q.current);
        return;
      }

      if (q.tracks.length > 0) {
        await playTrack(guildId, q.tracks.shift()!);
      } else {
        q.current = null;
        setTimeout(() => {
          const q2 = getQueue(guildId);
          if (q2 && !q2.current && q2.tracks.length === 0) {
            deleteQueue(guildId);
          }
        }, 30_000);
      }
    });

    player.on("error", (err) => {
      logger.error({ err }, "AudioPlayer Fehler");
    });

    connection.on(VoiceConnectionStatus.Disconnected, () => {
      deleteQueue(guildId);
    });
  }

  await playTrack(guildId, track);
  return queue;
}

export function skipTrack(guildId: string): Track | null {
  const queue = getQueue(guildId);
  if (!queue) return null;

  const skipped = queue.current;
  if (queue.tracks.length > 0) {
    void playTrack(guildId, queue.tracks.shift()!);
  } else {
    queue.player.stop();
    queue.current = null;
  }
  return skipped;
}

export function stopPlayback(guildId: string): void {
  deleteQueue(guildId);
}

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "∞";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
