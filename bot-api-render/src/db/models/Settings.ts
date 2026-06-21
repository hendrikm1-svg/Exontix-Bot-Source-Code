import { mongoose } from "../mongoose";

const settingsSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, unique: true },
    prefix: { type: String, default: "!" },
    language: { type: String, default: "en" },
    modLogChannel: { type: String },
    welcomeChannel: { type: String },
    leaveChannel: { type: String },
    ticketCategory: { type: String },
    ticketLogChannel: { type: String },
    levelUpChannel: { type: String },
    levelEnabled: { type: Boolean, default: true },
    economyEnabled: { type: Boolean, default: false },
    aiEnabled: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const Settings = mongoose.model("Settings", settingsSchema);
