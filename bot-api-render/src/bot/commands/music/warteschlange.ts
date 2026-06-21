import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import type { Command } from "../../client";
import { getQueue } from "../../music/queue";

export const warteschlangeCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("warteschlange")
    .setDescription("Zeigt die aktuelle Musik-Warteschlange") as SlashCommandBuilder,

  async execute(interaction) {
    const queue = getQueue(interaction.guild!.id);

    if (!queue?.current) {
      await interaction.reply({ content: "❌ Die Warteschlange ist leer.", ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("🎵 Musik-Warteschlange")
      .addFields({
        name: "▶️ Jetzt läuft",
        value: `**[${queue.current.title}](${queue.current.url})** — ${queue.current.duration} | <@${queue.current.requestedBy}>`,
      });

    if (queue.tracks.length > 0) {
      const list = queue.tracks
        .slice(0, 10)
        .map((t, i) => `\`${i + 1}.\` [${t.title}](${t.url}) — ${t.duration} | <@${t.requestedBy}>`)
        .join("\n");

      embed.addFields({
        name: `📋 Als nächstes (${queue.tracks.length} Songs)`,
        value: list + (queue.tracks.length > 10 ? `\n… und ${queue.tracks.length - 10} weitere` : ""),
      });
    } else {
      embed.addFields({ name: "📋 Warteschlange", value: "Keine weiteren Songs" });
    }

    embed.setFooter({ text: `🔁 Loop: ${queue.loop ? "An" : "Aus"} • 🔊 Lautstärke: ${queue.volume}%` });
    await interaction.reply({ embeds: [embed] });
  },
};
