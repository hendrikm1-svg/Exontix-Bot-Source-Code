import type { VoiceConnection, AudioPlayer } from "@discordjs/voice";

export interface Track {
  title: string;
  url: string;
  duration: string;
  thumbnail: string | null;
  requestedBy: string;
}

export interface GuildQueue {
  tracks: Track[];
  current: Track | null;
  connection: VoiceConnection;
  player: AudioPlayer;
  textChannelId: string;
  volume: number;
  loop: boolean;
}

// In-memory queue per guild
const queues = new Map<string, GuildQueue>();

export function getQueue(guildId: string): GuildQueue | undefined {
  return queues.get(guildId);
}

export function setQueue(guildId: string, queue: GuildQueue): void {
  queues.set(guildId, queue);
}

export function deleteQueue(guildId: string): void {
  const queue = queues.get(guildId);
  if (queue) {
    queue.player.stop(true);
    queue.connection.destroy();
    queues.delete(guildId);
  }
}
