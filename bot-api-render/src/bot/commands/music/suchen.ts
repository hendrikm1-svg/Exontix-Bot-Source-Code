import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ComponentType,
} from "discord.js";
import type { Command } from "../../client";
import { searchTracks, joinAndPlay } from "../../music/player";
import { getQueue } from "../../music/queue";
import { logger } from "../../../lib/logger";

export const suchenCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("suchen")
    .setDescription("Sucht nach Songs auf YouTube/Spotify und zeigt eine Auswahl")
    .addStringOption((o) =>
      o.setName("titel").setDescription("Song-Titel oder Künstler suchen").setRequired(true),
    ) as SlashCommandBuilder,

  async execute(interaction) {
    await interaction.deferReply();

    const query = interaction.options.getString("titel", true);

    try {
      const tracks = await searchTracks(query);
      if (!tracks.length) {
        await interaction.editReply({ content: "❌ Keine Ergebnisse gefunden." });
        return;
      }

      const limited = tracks.slice(0, 5);

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`🔍 Suchergebnisse für: "${query}"`)
        .setDescription("Wähle einen Song aus dem Menü unten aus:")
        .addFields(
          limited.map((t, i) => ({
            name: `${i + 1}. ${t.title}`,
            value: `⏱️ ${t.duration}`,
            inline: false,
          })),
        )
        .setFooter({ text: "Auswahl läuft in 30 Sekunden ab" });

      const select = new StringSelectMenuBuilder()
        .setCustomId("music:select")
        .setPlaceholder("Song auswählen…")
        .addOptions(
          limited.map((t, i) =>
            new StringSelectMenuOptionBuilder()
              .setLabel(t.title.slice(0, 100))
              .setDescription(`Dauer: ${t.duration}`)
              .setValue(String(i)),
          ),
        );

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
      const reply = await interaction.editReply({ embeds: [embed], components: [row] });

      const collector = reply.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 30_000,
        filter: (i) => i.user.id === interaction.user.id,
      });

      collector.on("collect", async (selectInteraction) => {
        const idx = parseInt(selectInteraction.values[0] ?? "0", 10);
        const track = { ...limited[idx]!, requestedBy: interaction.user.id };

        const member = interaction.guild?.members.cache.get(interaction.user.id);
        const voiceChannel = member?.voice.channel;

        if (!voiceChannel) {
          await selectInteraction.update({ content: "❌ Tritt zuerst einem Sprachkanal bei!", embeds: [], components: [] });
          return;
        }

        const queue = getQueue(interaction.guild!.id);
        if (queue) {
          queue.tracks.push(track);
          await selectInteraction.update({
            content: `➕ **${track.title}** zur Warteschlange hinzugefügt (Position #${queue.tracks.length})`,
            embeds: [],
            components: [],
          });
        } else {
          await joinAndPlay(interaction.guild!.id, voiceChannel, interaction.channel!, track);
          await selectInteraction.update({
            content: `▶️ Spiele jetzt **${track.title}** ab!`,
            embeds: [],
            components: [],
          });
        }
        collector.stop();
      });

      collector.on("end", (_, reason) => {
        if (reason === "time") {
          interaction.editReply({ content: "⏱️ Auswahl abgelaufen.", embeds: [], components: [] }).catch(() => null);
        }
      });
    } catch (err) {
      logger.error({ err, query }, "Suchen Fehler");
      await interaction.editReply({ content: "❌ Fehler bei der Suche." });
    }
  },
};
