import { mongoose } from "../mongoose";

const verifyConfigSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, unique: true },
    enabled: { type: Boolean, default: true },
    roleId: { type: String },
    channelId: { type: String },
    message: { type: String, default: "Klicke auf den Button unten, um dich zu verifizieren und Zugang zum Server zu erhalten." },
    buttonLabel: { type: String, default: "Verifizieren" },
    logChannelId: { type: String },
  },
  { timestamps: true },
);

export const VerifyConfig = mongoose.model("VerifyConfig", verifyConfigSchema);
