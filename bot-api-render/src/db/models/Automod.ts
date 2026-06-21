import { mongoose } from "../mongoose";

const automodSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, unique: true },
    antiSpam: {
      enabled: { type: Boolean, default: false },
      threshold: { type: Number, default: 5 },
      interval: { type: Number, default: 5000 },
      action: { type: String, enum: ["warn", "mute", "kick", "ban"], default: "warn" },
    },
    antiRaid: {
      enabled: { type: Boolean, default: false },
      joinThreshold: { type: Number, default: 10 },
      joinInterval: { type: Number, default: 10000 },
      action: { type: String, enum: ["kick", "ban"], default: "kick" },
    },
    antiLink: {
      enabled: { type: Boolean, default: false },
      whitelist: [{ type: String }],
      action: { type: String, enum: ["delete", "warn", "kick"], default: "delete" },
    },
    antiInvite: {
      enabled: { type: Boolean, default: false },
      action: { type: String, enum: ["delete", "warn", "kick"], default: "delete" },
    },
    antiScam: {
      enabled: { type: Boolean, default: false },
    },
    antiMentionSpam: {
      enabled: { type: Boolean, default: false },
      threshold: { type: Number, default: 5 },
      action: { type: String, enum: ["warn", "mute", "kick"], default: "warn" },
    },
    ignoredRoles: [{ type: String }],
    ignoredChannels: [{ type: String }],
  },
  { timestamps: true },
);

export const Automod = mongoose.model("Automod", automodSchema);
