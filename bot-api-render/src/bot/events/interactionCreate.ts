import type { Interaction } from "discord.js";
import { EmbedBuilder, Colors } from "discord.js";
import { logger } from "../../lib/logger";
import { botClient } from "../client";
import { handleTicketCreate } from "../commands/tickets/ticket";
import { handleVerifyClick } from "../commands/verify/verify";

export async function onInteractionCreate(interaction: Interaction): Promise<void> {
  if (interaction.isChatInputCommand()) {
    const command = botClient.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (err) {
      logger.error({ err, command: interaction.commandName }, "Befehl Ausführungsfehler");
      const msg = { content: "❌ Beim Ausführen dieses Befehls ist ein Fehler aufgetreten.", ephemeral: true } as const;
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg).catch(() => null);
      } else {
        await interaction.reply(msg).catch(() => null);
      }
    }
    return;
  }

  if (interaction.isButton()) {
    const id = interaction.customId;

    // ── Verify ──────────────────────────────────────────────────
    if (id === "verify:click") {
      await handleVerifyClick(interaction);
      return;
    }

    // ── Ticket panel buttons (dynamic: ticket:create:<type>) ─────
    if (id.startsWith("ticket:create:")) {
      const ticketType = id.slice("ticket:create:".length) || "general";
      await handleTicketCreate(interaction, ticketType);
      return;
    }

    // ── Legacy button IDs (backwards compatibility) ──────────────
    if (id === "ticket:create") {
      await handleTicketCreate(interaction, "general");
      return;
    }
    if (id === "ticket:create_tech") {
      await handleTicketCreate(interaction, "tech");
      return;
    }
    if (id === "ticket:create_report") {
      await handleTicketCreate(interaction, "report");
      return;
    }

    // ── Ticket claim button ──────────────────────────────────────
    if (id === "ticket:claim_btn") {
      const { Ticket } = await import("../../db/models/Ticket");
      const ticket = await Ticket.findOne({
        guildId: interaction.guild!.id,
        channelId: interaction.channel!.id,
        status: "open",
      });

      if (!ticket) {
        await interaction.reply({ content: "❌ Dies ist kein offener Ticket-Kanal.", ephemeral: true });
        return;
      }

      if (ticket.claimedBy) {
        await interaction.reply({
          content: `❌ Dieses Ticket wurde bereits von <@${ticket.claimedBy}> übernommen.`,
          ephemeral: true,
        });
        return;
      }

      ticket.claimedBy = interaction.user.id;
      await ticket.save();

      const embed = new EmbedBuilder()
        .setColor(Colors.Green)
        .setDescription(`✋ <@${interaction.user.id}> hat dieses Ticket übernommen. Der **KI-Assistent** ist deaktiviert.`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }

    // ── Ticket close button ──────────────────────────────────────
    if (id === "ticket:close_btn") {
      await interaction.deferReply({ ephemeral: true });
      const { Ticket } = await import("../../db/models/Ticket");
      const { emitToGuild } = await import("../../websocket/server");
      const { clearTicketHistory } = await import("../ai/ticketAssistant");

      const ticket = await Ticket.findOne({
        guildId: interaction.guild!.id,
        channelId: interaction.channel!.id,
        status: "open",
      });

      if (!ticket) {
        await interaction.editReply({ content: "❌ Dies ist kein offener Ticket-Kanal." });
        return;
      }

      const channel = interaction.channel;
      if (!channel || !("messages" in channel)) {
        await interaction.editReply({ content: "❌ Nachrichten können nicht abgerufen werden." });
        return;
      }

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

      clearTicketHistory(ticket.channelId);

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

      await (channel as import("discord.js").TextChannel).send({ embeds: [closeEmbed] }).catch(() => null);
      await interaction.editReply({ content: "✅ Ticket geschlossen. Kanal wird in 5 Sekunden gelöscht." });

      if ("delete" in channel) {
        setTimeout(() => {
          (channel as { delete: (reason: string) => Promise<unknown> }).delete("Ticket geschlossen").catch(() => null);
        }, 5000);
      }
      return;
    }
  }
}
