import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  MessageFlags,
  Colors,
  type TextChannel,
  type ButtonInteraction,
} from "discord.js";
import type { Command } from "../../client";
import { TicketConfig, Ticket } from "../../../db/models/Ticket";
import { emitToGuild } from "../../../websocket/server";
import { logger } from "../../../lib/logger";

// Convert stored style string to Discord ButtonStyle
function resolveStyle(style: string): ButtonStyle {
  switch (style) {
    case "Success": return ButtonStyle.Success;
    case "Danger": return ButtonStyle.Danger;
    case "Secondary": return ButtonStyle.Secondary;
    default: return ButtonStyle.Primary;
  }
}

export const ticketCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Ticket-System Verwaltung")
    .addSubcommand((s) => s.setName("panel").setDescription("Sendet ein Ticket-Panel in diesen Kanal"))
    .addSubcommand((s) => s.setName("schliessen").setDescription("Schließt das aktuelle Ticket"))
    .addSubcommand((s) =>
      s.setName("einrichten")
        .setDescription("Richtet das Ticket-System ein")
        .addChannelOption((o) =>
          o.setName("kategorie").setDescription("Kategorie für Ticket-Kanäle").addChannelTypes(ChannelType.GuildCategory))
        .addChannelOption((o) =>
          o.setName("log-kanal").setDescription("Kanal für Ticket-Logs").addChannelTypes(ChannelType.GuildText))
        .addRoleOption((o) => o.setName("support-rolle").setDescription("Support-Team Rolle")),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels) as SlashCommandBuilder,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === "einrichten") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const kategorie = interaction.options.getChannel("kategorie");
      const logKanal = interaction.options.getChannel("log-kanal");
      const supportRolle = interaction.options.getRole("support-rolle");

      const updates: Record<string, unknown> = { enabled: true };
      if (kategorie) updates["categoryId"] = kategorie.id;
      if (logKanal) updates["logChannelId"] = logKanal.id;
      if (supportRolle) updates["supportRoles"] = [supportRolle.id];

      await TicketConfig.findOneAndUpdate(
        { guildId: interaction.guild!.id },
        { $set: updates },
        { upsert: true, new: true },
      );

      await interaction.editReply({
        content: `✅ Ticket-System aktiviert!\n${kategorie ? `📁 Kategorie: ${kategorie}\n` : ""}${logKanal ? `📋 Log-Kanal: ${logKanal}\n` : ""}${supportRolle ? `👥 Support-Rolle: ${supportRolle}\n` : ""}`,
      });
      return;
    }

    if (sub === "panel") {
      await TicketConfig.findOneAndUpdate(
        { guildId: interaction.guild!.id },
        { $set: { enabled: true } },
        { upsert: true },
      );

      const config = await TicketConfig.findOne({ guildId: interaction.guild!.id });

      const title = config?.panelTitle ?? "🎫 Exontix Support";
      const description = config?.panelDescription ?? "Benötigst du Hilfe? Klicke auf einen Button unten!";
      const colorHex = config?.panelColor ?? "#5865F2";
      const color = parseInt(colorHex.replace("#", ""), 16);

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(description)
        .setFooter({ text: `${interaction.guild!.name} • Exontix Support-System` })
        .setTimestamp();

      if (config?.showThumbnail !== false) {
        embed.setThumbnail(interaction.guild!.iconURL());
      }

      // Build buttons: use custom if configured, else use defaults
      const storedButtons = config?.panelButtons ?? [];
      const buttons = storedButtons.length > 0 ? storedButtons : [
        { label: "Ticket öffnen", emoji: "🎫", style: "Primary", ticketType: "general" },
        { label: "Technisches Problem", emoji: "🔧", style: "Secondary", ticketType: "tech" },
        { label: "Nutzer melden", emoji: "🚨", style: "Danger", ticketType: "report" },
      ];

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        buttons.slice(0, 5).map((btn) =>
          new ButtonBuilder()
            .setCustomId(`ticket:create:${btn.ticketType}`)
            .setLabel(btn.label)
            .setStyle(resolveStyle(btn.style))
            .setEmoji(btn.emoji),
        ),
      );

      await interaction.reply({ embeds: [embed], components: [row] });
      return;
    }

    if (sub === "schliessen") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const ticket = await Ticket.findOne({
        guildId: interaction.guild!.id,
        channelId: interaction.channel!.id,
        status: "open",
      });

      if (!ticket) {
        await interaction.editReply({ content: "❌ Dies ist kein offener Ticket-Kanal." });
        return;
      }

      try {
        const channel = interaction.channel as TextChannel;
        const messages = await channel.messages.fetch({ limit: 100 });
        const transcript = [...messages.values()]
          .reverse()
          .map((m) => `[${m.createdAt.toISOString()}] ${m.author.tag ?? "Unbekannt"}: ${m.content ?? ""}`)
          .join("\n");

        ticket.status = "closed";
        ticket.closedAt = new Date();
        ticket.closedBy = interaction.user.id;
        ticket.transcript = transcript;
        await ticket.save();

        emitToGuild(interaction.guild!.id, "ticket:closed", {
          ticketId: ticket._id,
          channelId: ticket.channelId,
          userId: ticket.userId,
          closedBy: interaction.user.id,
        });

        const closeEmbed = new EmbedBuilder()
          .setColor(Colors.Red)
          .setTitle("🔒 Ticket geschlossen")
          .addFields(
            { name: "Geschlossen von", value: `<@${interaction.user.id}>`, inline: true },
            { name: "Nutzer", value: `<@${ticket.userId}>`, inline: true },
          )
          .setTimestamp();

        await channel.send({ embeds: [closeEmbed] });
        await interaction.editReply({ content: "✅ Ticket geschlossen. Kanal wird in 5 Sekunden gelöscht." });
        setTimeout(() => { channel.delete("Ticket geschlossen").catch(() => null); }, 5000);
      } catch (err) {
        logger.error({ err }, "ticket schließen Fehler");
        await interaction.editReply({ content: "❌ Fehler beim Schließen des Tickets." });
      }
    }
  },
};

export async function handleTicketCreate(
  interaction: ButtonInteraction,
  ticketType: string,
): Promise<void> {
  const guild = interaction.guild!;
  const user = interaction.user;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const config = await TicketConfig.findOneAndUpdate(
      { guildId: guild.id },
      { $setOnInsert: { guildId: guild.id, enabled: true } },
      { upsert: true, new: true },
    );

    if (!config.enabled) {
      await interaction.editReply({ content: "❌ Das Ticket-System ist nicht aktiviert. Nutze `/ticket einrichten`." });
      return;
    }

    const existing = await Ticket.findOne({ guildId: guild.id, userId: user.id, status: "open" });
    if (existing) {
      await interaction.editReply({ content: `❌ Du hast bereits ein offenes Ticket: <#${existing.channelId}>` });
      return;
    }

    // Resolve category channel
    let resolvedParentId: string | undefined;
    if (config.categoryId) {
      const parentChannel = guild.channels.cache.get(config.categoryId);
      if (parentChannel && parentChannel.type === ChannelType.GuildCategory) {
        resolvedParentId = config.categoryId;
      } else {
        logger.warn({ guildId: guild.id, categoryId: config.categoryId }, "Gespeicherte Ticket-Kategorie ist kein Kategorie-Kanal — erstelle neue");
        const newCategory = await guild.channels.create({
          name: "🎫 Tickets",
          type: ChannelType.GuildCategory,
          permissionOverwrites: [{ id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] }],
        });
        resolvedParentId = newCategory.id;
        await TicketConfig.findOneAndUpdate({ guildId: guild.id }, { $set: { categoryId: newCategory.id } });
      }
    } else {
      const existingCat = guild.channels.cache.find(
        (c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes("ticket"),
      );
      if (existingCat) {
        resolvedParentId = existingCat.id;
      } else {
        const newCategory = await guild.channels.create({
          name: "🎫 Tickets",
          type: ChannelType.GuildCategory,
          permissionOverwrites: [{ id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] }],
        });
        resolvedParentId = newCategory.id;
        await TicketConfig.findOneAndUpdate({ guildId: guild.id }, { $set: { categoryId: newCategory.id } });
      }
    }

    // Find matching button config for label/emoji (fallback to type name)
    const storedButtons = config.panelButtons ?? [];
    const matchingBtn = storedButtons.find((b) => b.ticketType === ticketType);
    const channelName = (matchingBtn?.label ?? ticketType).toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 20);
    const safeName = user.username.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 15) || "user";
    const emoji = matchingBtn?.emoji ?? "🎫";
    const label = matchingBtn?.label ?? ticketType;

    const channel = await guild.channels.create({
      name: `${channelName}-${safeName}`,
      type: ChannelType.GuildText,
      parent: resolvedParentId,
      permissionOverwrites: [
        { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: user.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
        },
        ...(config.supportRoles ?? []).map((roleId) => ({
          id: roleId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageMessages,
          ],
        })),
      ],
    });

    const ticket = await Ticket.create({
      guildId: guild.id,
      channelId: channel.id,
      userId: user.id,
      type: ticketType,
    });

    const openEmbed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`${emoji} ${label} — Ticket #${String(ticket._id).slice(-4).toUpperCase()}`)
      .setDescription(
        `Willkommen <@${user.id}>!\n\n` +
        `**Beschreibe dein Anliegen** so genau wie möglich.\n` +
        `🤖 Der **KI-Assistent** antwortet sofort — das Support-Team übernimmt falls nötig.\n\n` +
        `> Ticket-Typ: **${label}**`,
      )
      .setThumbnail(user.displayAvatarURL())
      .setFooter({ text: "Exontix Support • Antworte auf deine Frage im Chat" })
      .setTimestamp();

    const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket:close_btn")
        .setLabel("Ticket schließen")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("🔒"),
      new ButtonBuilder()
        .setCustomId("ticket:claim_btn")
        .setLabel("Ticket übernehmen")
        .setStyle(ButtonStyle.Success)
        .setEmoji("✋"),
    );

    await channel.send({ content: `<@${user.id}>`, embeds: [openEmbed], components: [closeRow] });

    emitToGuild(guild.id, "ticket:created", {
      ticketId: ticket._id,
      channelId: channel.id,
      userId: user.id,
      type: ticketType,
    });

    await interaction.editReply({ content: `✅ Dein Ticket wurde erstellt: ${channel}` });
  } catch (err) {
    logger.error({ err }, "ticket erstellen Fehler");
    await interaction.editReply({ content: "❌ Fehler beim Erstellen des Tickets." });
  }
}
