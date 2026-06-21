import { mongoose } from "../mongoose";

const panelButtonSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    emoji: { type: String, default: "🎫" },
    style: { type: String, enum: ["Primary", "Secondary", "Success", "Danger"], default: "Primary" },
    ticketType: { type: String, required: true },
  },
  { _id: false },
);

const ticketConfigSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, unique: true },
    enabled: { type: Boolean, default: false },
    categoryId: { type: String },
    logChannelId: { type: String },
    supportRoles: [{ type: String }],
    maxTicketsPerUser: { type: Number, default: 1 },
    autoCloseAfterHours: { type: Number, default: 0 },
    transcriptEnabled: { type: Boolean, default: true },
    // Panel customization
    panelTitle: { type: String, default: "🎫 Exontix Support" },
    panelDescription: { type: String, default: "Benötigst du Hilfe? Unser Support-Team ist für dich da!\n\n🤖 **KI-Assistent** antwortet sofort\n👥 **Support-Team** übernimmt bei komplexen Fragen\n📝 **Transkript** wird nach Schließung gespeichert" },
    panelColor: { type: String, default: "#5865F2" },
    showThumbnail: { type: Boolean, default: true },
    panelButtons: { type: [panelButtonSchema], default: [] },
  },
  { timestamps: true },
);

const ticketSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true },
    channelId: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    type: { type: String, default: "general" },
    status: { type: String, enum: ["open", "closed", "deleted"], default: "open" },
    claimedBy: { type: String },
    transcript: { type: String },
    closedAt: { type: Date },
    closedBy: { type: String },
  },
  { timestamps: true },
);

export const TicketConfig = mongoose.model("TicketConfig", ticketConfigSchema);
export const Ticket = mongoose.model("Ticket", ticketSchema);
