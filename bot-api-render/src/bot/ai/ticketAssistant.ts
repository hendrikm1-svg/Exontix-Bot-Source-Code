import OpenAI from "openai";
import type { Message } from "discord.js";
import { EmbedBuilder } from "discord.js";
import { Ticket } from "../../db/models/Ticket";
import { logger } from "../../lib/logger";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Per-channel conversation history (last 20 messages for better context)
const conversationHistory = new Map<string, Array<{ role: "user" | "assistant"; content: string }>>();

const SYSTEM_PROMPT = `Du bist ein intelligenter, freundlicher Support-Assistent für einen Discord-Server.
Antworte immer auf Deutsch. Sei präzise, hilfsbereit und professionell.
Analysiere das Problem des Nutzers sorgfältig und gib konkrete Lösungsvorschläge.
Wenn du etwas nicht weißt, sage es ehrlich und erkläre, dass ein Teammitglied helfen wird.
Nutze kurze Absätze. Formatiere mit **fett** für wichtige Punkte. Maximal 5 Sätze pro Antwort.
Wenn ein Nutzer seine Frage bereits beantwortet bekommen hat, frage ob du noch weiter helfen kannst.
WICHTIG: Antworte auf ALLE Nachrichten im Ticket (nicht nur vom Ticket-Ersteller), solange kein Teammitglied übernommen hat.`;

export async function handleTicketAI(message: Message): Promise<void> {
  if (!message.guild || !message.channel || !("send" in message.channel)) return;
  // Skip bots and the AI's own messages
  if (message.author.bot) return;

  // Check if this is an open ticket channel
  const ticket = await Ticket.findOne({
    guildId: message.guild.id,
    channelId: message.channel.id,
    status: "open",
  }).catch(() => null);

  if (!ticket) return;

  // Stop AI once a team member has claimed the ticket
  if (ticket.claimedBy) return;

  const channelId = message.channel.id;
  if (!conversationHistory.has(channelId)) {
    conversationHistory.set(channelId, []);
  }
  const history = conversationHistory.get(channelId)!;

  // Include author name for context in multi-user tickets
  const userLabel = `[${message.author.displayName ?? message.author.username}]`;
  history.push({ role: "user", content: `${userLabel} ${message.content}` });

  // Keep last 20 messages for better context
  if (history.length > 20) history.splice(0, history.length - 20);

  try {
    await (message.channel as { sendTyping: () => Promise<void> }).sendTyping();

    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history],
      max_tokens: 500,
      temperature: 0.6,
    });

    const reply = completion.choices[0]?.message?.content ?? "Entschuldigung, ich konnte keine Antwort generieren.";
    history.push({ role: "assistant", content: reply });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setAuthor({ name: "🤖 Exontix KI-Assistent" })
      .setDescription(reply)
      .setFooter({ text: "KI-Antwort • Teammitglied kann mit ✋ Ticket übernehmen" });

    await (message.channel as { send: (opts: unknown) => Promise<unknown> }).send({ embeds: [embed] });
  } catch (err) {
    logger.error({ err }, "Ticket KI-Assistent Fehler");
  }
}

export function clearTicketHistory(channelId: string): void {
  conversationHistory.delete(channelId);
}
