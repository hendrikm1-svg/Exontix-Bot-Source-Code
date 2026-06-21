import { mongoose } from "../mongoose";

const welcomeSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, unique: true },
    enabled: { type: Boolean, default: false },
    channelId: { type: String },
    embedEnabled: { type: Boolean, default: true },
    embedColor: { type: String, default: "#5865F2" },
    embedTitle: { type: String, default: "Welcome!" },
    embedDescription: { type: String, default: "Welcome to {server}, {user}! You are member #{count}." },
    embedFooter: { type: String },
    embedThumbnail: { type: Boolean, default: true },
    imageEnabled: { type: Boolean, default: false },
    imageBackground: { type: String },
    imageText: { type: String, default: "Welcome {username}!" },
    dmEnabled: { type: Boolean, default: false },
    dmMessage: { type: String },
  },
  { timestamps: true },
);

export const Welcome = mongoose.model("Welcome", welcomeSchema);
