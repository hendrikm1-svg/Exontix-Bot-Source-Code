import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, type TextChannel } from "discord.js";
import type { Command } from "../../client";
import { logger } from "../../../lib/logger";

export const lockCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("lock")
    .setDescription("Sperrt einen Kanal (verhindert Nachrichten)")
    .addChannelOption((o) => o.setName("kanal").setDescription("Kanal der gesperrt wird (Standard: aktueller Kanal)"))
    .addStringOption((o) => o.setName("grund").setDescription("Grund für die Sperre"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels) as SlashCommandBuilder,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const channel = (interaction.options.getChannel("kanal") ?? interaction.channel) as TextChannel;
    const reason = interaction.options.getString("grund") ?? "Kein Grund angegeben";

    try {
      await channel.permissionOverwrites.edit(interaction.guild!.roles.everyone, {
        SendMessages: false,
      }, { reason });

      const embed = new EmbedBuilder()
        .setColor(0xe74c3c).setTitle("🔒 Kanal gesperrt")
        .setDescription(`${channel} wurde gesperrt.\nGrund: ${reason}`)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      logger.error({ err }, "lock Befehl Fehler");
      await interaction.editReply({ content: "❌ Fehler beim Sperren des Kanals." });
    }
  },
};
