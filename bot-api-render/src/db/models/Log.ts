import { mongoose } from "../mongoose";

const logConfigSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, unique: true },
    messageDelete: { type: String },
    messageEdit: { type: String },
    memberJoin: { type: String },
    memberLeave: { type: String },
    voiceState: { type: String },
    modActions: { type: String },
  },
  { timestamps: true },
);

const logEntrySchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true },
    type: {
      type: String,
      enum: ["messageDelete", "messageEdit", "memberJoin", "memberLeave", "voiceState", "mod", "automod"],
      required: true,
    },
    userId: { type: String },
    targetId: { type: String },
    channelId: { type: String },
    content: { type: String },
    extra: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true },
);

logEntrySchema.index({ guildId: 1, createdAt: -1 });

export const LogConfig = mongoose.model("LogConfig", logConfigSchema);
export const LogEntry = mongoose.model("LogEntry", logEntrySchema);
