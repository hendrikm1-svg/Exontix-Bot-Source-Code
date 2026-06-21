import { SlashCommandBuilder, PermissionFlagsBits, type TextChannel } from "discord.js";
import type { Command } from "../../client";
import { logger } from "../../../lib/logger";

export const clearCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Löscht mehrere Nachrichten auf einmal")
    .addIntegerOption((o) => o.setName("anzahl").setDescription("Anzahl der zu löschenden Nachrichten (1-100)").setRequired(true).setMinValue(1).setMaxValue(100))
    .addUserOption((o) => o.setName("user").setDescription("Nur Nachrichten dieses Nutzers löschen"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages) as SlashCommandBuilder,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const amount = interaction.options.getInteger("anzahl", true);
    const targetUser = interaction.options.getUser("user");
    const channel = interaction.channel as TextChannel;

    try {
      let messages = await channel.messages.fetch({ limit: 100 });

      if (targetUser) {
        messages = messages.filter((m) => m.author.id === targetUser.id);
      }

      const toDelete = [...messages.values()].slice(0, amount);
      const deleted = await channel.bulkDelete(toDelete, true);

      await interaction.editReply({
        content: `✅ ${deleted.size} Nachricht${deleted.size !== 1 ? "en" : ""} gelöscht.`,
      });
    } catch (err) {
      logger.error({ err }, "clear Befehl Fehler");
      await interaction.editReply({ content: "❌ Fehler beim Löschen der Nachrichten." });
    }
  },
};
