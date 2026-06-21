import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  Colors,
  type GuildMember,
} from "discord.js";
import type { Command } from "../../client";
import { VerifyConfig } from "../../../db/models/Verify";
import { logger } from "../../../lib/logger";

export const verifyCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("verify")
    .setDescription("Verifizierungs-System")
    .addSubcommand((s) =>
      s
        .setName("einrichten")
        .setDescription("Richtet das Verifizierungs-System ein")
        .addRoleOption((o) =>
          o.setName("rolle").setDescription("Rolle, die nach Verifizierung vergeben wird").setRequired(true),
        )
        .addChannelOption((o) =>
          o.setName("log-kanal").setDescription("Kanal für Verifizierungs-Logs").setRequired(false),
        )
        .addStringOption((o) =>
          o.setName("nachricht").setDescription("Nachricht im Verifizierungs-Panel").setRequired(false),
        )
        .addStringOption((o) =>
          o.setName("button-text").setDescription("Text auf dem Verifizierungs-Button").setRequired(false),
        ),
    )
    .addSubcommand((s) =>
      s.setName("panel").setDescription("Sendet ein Verifizierungs-Panel in diesen Kanal"),
    )
    .addSubcommand((s) =>
      s.setName("status").setDescription("Zeigt die aktuelle Verifizierungs-Konfiguration"),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) as SlashCommandBuilder,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild!.id;

    if (sub === "einrichten") {
      await interaction.deferReply({ ephemeral: true });

      const rolle = interaction.options.getRole("rolle", true);
      const logKanal = interaction.options.getChannel("log-kanal");
      const nachricht = interaction.options.getString("nachricht");
      const buttonText = interaction.options.getString("button-text");

      const updates: Record<string, unknown> = {
        enabled: true,
        roleId: rolle.id,
      };
      if (logKanal) updates["logChannelId"] = logKanal.id;
      if (nachricht) updates["message"] = nachricht;
      if (buttonText) updates["buttonLabel"] = buttonText;

      await VerifyConfig.findOneAndUpdate(
        { guildId },
        { $set: updates },
        { upsert: true, new: true },
      );

      const embed = new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle("✅ Verifizierungs-System eingerichtet")
        .addFields(
          { name: "Rolle", value: `<@&${rolle.id}>`, inline: true },
          { name: "Button", value: buttonText ?? "Verifizieren", inline: true },
          ...(logKanal ? [{ name: "Log-Kanal", value: `<#${logKanal.id}>`, inline: true }] : []),
        )
        .setDescription("Nutze `/verify panel`, um das Verifizierungs-Panel zu senden.")
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }

    if (sub === "panel") {
      const config = await VerifyConfig.findOne({ guildId });

      if (!config?.roleId) {
        await interaction.reply({
          content: "❌ Das Verifizierungs-System ist noch nicht eingerichtet. Nutze `/verify einrichten` zuerst.",
          ephemeral: true,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle("✅ Verifizierung")
        .setDescription(config.message)
        .setThumbnail(interaction.guild!.iconURL())
        .setFooter({ text: `${interaction.guild!.name} • Verifizierung` })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("verify:click")
          .setLabel(config.buttonLabel ?? "Verifizieren")
          .setStyle(ButtonStyle.Success)
          .setEmoji("✅"),
      );

      await interaction.reply({ embeds: [embed], components: [row] });
    }

    if (sub === "status") {
      await interaction.deferReply({ ephemeral: true });
      const config = await VerifyConfig.findOne({ guildId });

      if (!config) {
        await interaction.editReply({ content: "❌ Verifizierungs-System noch nicht eingerichtet." });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("🔍 Verifizierungs-Status")
        .addFields(
          { name: "Status", value: config.enabled ? "✅ Aktiv" : "❌ Deaktiviert", inline: true },
          { name: "Rolle", value: config.roleId ? `<@&${config.roleId}>` : "Keine", inline: true },
          { name: "Log-Kanal", value: config.logChannelId ? `<#${config.logChannelId}>` : "Keiner", inline: true },
        );

      await interaction.editReply({ embeds: [embed] });
    }
  },
};

export async function handleVerifyClick(
  interaction: import("discord.js").ButtonInteraction,
): Promise<void> {
  const guildId = interaction.guild!.id;
  const member = interaction.member as GuildMember;

  await interaction.deferReply({ ephemeral: true });

  try {
    const config = await VerifyConfig.findOne({ guildId });

    if (!config?.enabled || !config.roleId) {
      await interaction.editReply({ content: "❌ Das Verifizierungs-System ist nicht aktiv." });
      return;
    }

    if (member.roles.cache.has(config.roleId)) {
      await interaction.editReply({ content: "✅ Du bist bereits verifiziert!" });
      return;
    }

    await member.roles.add(config.roleId, "Verifizierung per Button");

    await interaction.editReply({
      content: `✅ Du wurdest erfolgreich verifiziert und hast die Rolle <@&${config.roleId}> erhalten!`,
    });

    if (config.logChannelId) {
      const logChannel = interaction.guild!.channels.cache.get(config.logChannelId);
      if (logChannel && "send" in logChannel) {
        const logEmbed = new EmbedBuilder()
          .setColor(Colors.Green)
          .setTitle("✅ Nutzer verifiziert")
          .addFields(
            { name: "Nutzer", value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
            { name: "Rolle", value: `<@&${config.roleId}>`, inline: true },
          )
          .setThumbnail(interaction.user.displayAvatarURL())
          .setTimestamp();
        await logChannel.send({ embeds: [logEmbed] }).catch(() => null);
      }
    }
  } catch (err) {
    logger.error({ err }, "Verifizierung Fehler");
    await interaction.editReply({ content: "❌ Fehler bei der Verifizierung. Bitte wende dich an einen Admin." });
  }
}
