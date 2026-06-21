import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import type { Command } from "../../client";
import { searchTracks, joinAndPlay } from "../../music/player";
import { getQueue } from "../../music/queue";
import { logger } from "../../../lib/logger";

export const abspielenCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("abspielen")
    .setDescription("Spielt einen Song ab — YouTube, Spotify oder einfach suchen")
    .addStringOption((o) =>
      o.setName("suche")
        .setDescription("Song-Titel, Künstler, YouTube-URL oder Spotify-Link")
        .setRequired(true),
    ) as SlashCommandBuilder,

  async execute(interaction) {
    await interaction.deferReply();

    const member = interaction.guild?.members.cache.get(interaction.user.id);
    const voiceChannel = member?.voice.channel;

    if (!voiceChannel) {
      await interaction.editReply({ content: "❌ Du musst zuerst einem Sprachkanal beitreten!" });
      return;
    }

    if (!voiceChannel.joinable) {
      await interaction.editReply({ content: "❌ Ich habe keine Berechtigung, diesem Sprachkanal beizutreten." });
      return;
    }

    const query = interaction.options.getString("suche", true);

    try {
      const tracks = await searchTracks(query);
      if (!tracks.length) {
        await interaction.editReply({ content: "❌ Keine Ergebnisse gefunden. Versuche einen anderen Suchbegriff." });
        return;
      }

      const track = { ...tracks[0], requestedBy: interaction.user.id };
      const queue = getQueue(interaction.guild!.id);

      if (queue) {
        queue.tracks.push(track);
        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("➕ Zur Warteschlange hinzugefügt")
          .setDescription(`**[${track.title}](${track.url})**`)
          .addFields(
            { name: "Dauer", value: track.duration, inline: true },
            { name: "Position", value: `#${queue.tracks.length}`, inline: true },
          )
          .setThumbnail(track.thumbnail)
          .setFooter({ text: `Angefragt von ${interaction.user.displayName}` });
        await interaction.editReply({ embeds: [embed] });
      } else {
        await joinAndPlay(interaction.guild!.id, voiceChannel, interaction.channel!, track);

        const embed = new EmbedBuilder()
          .setColor(0x1db954)
          .setTitle("▶️ Jetzt läuft")
          .setDescription(`**[${track.title}](${track.url})**`)
          .addFields(
            { name: "Dauer", value: track.duration, inline: true },
            { name: "Kanal", value: voiceChannel.name, inline: true },
          )
          .setThumbnail(track.thumbnail)
          .setFooter({ text: `Angefragt von ${interaction.user.displayName} • YouTube / Spotify` });
        await interaction.editReply({ embeds: [embed] });
      }
    } catch (err) {
      logger.error({ err, query }, "Abspielen Fehler");
      await interaction.editReply({ content: "❌ Fehler beim Abspielen. Überprüfe den Link oder den Titel." });
    }
  },
};
