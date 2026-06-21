import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, type TextChannel } from "discord.js";
import type { Command } from "../../client";
import { logger } from "../../../lib/logger";

export const unlockCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("Entsperrt einen Kanal")
    .addChannelOption((o) => o.setName("kanal").setDescription("Kanal der entsperrt wird (Standard: aktueller Kanal)"))
    .addStringOption((o) => o.setName("grund").setDescription("Grund für die Entsperrung"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels) as SlashCommandBuilder,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const channel = (interaction.options.getChannel("kanal") ?? interaction.channel) as TextChannel;
    const reason = interaction.options.getString("grund") ?? "Kein Grund angegeben";

    try {
      await channel.permissionOverwrites.edit(interaction.guild!.roles.everyone, {
        SendMessages: null,
      }, { reason });

      const embed = new EmbedBuilder()
        .setColor(0x2ecc71).setTitle("🔓 Kanal entsperrt")
        .setDescription(`${channel} wurde entsperrt.\nGrund: ${reason}`)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      logger.error({ err }, "unlock Befehl Fehler");
      await interaction.editReply({ content: "❌ Fehler beim Entsperren des Kanals." });
    }
  },
};
