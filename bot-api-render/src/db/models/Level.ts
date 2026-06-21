import { mongoose } from "../mongoose";

const levelSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 0 },
    totalMessages: { type: Number, default: 0 },
  },
  { timestamps: true },
);

levelSchema.index({ guildId: 1, userId: 1 }, { unique: true });
levelSchema.index({ guildId: 1, xp: -1 });

const levelRoleSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  level: { type: Number, required: true },
  roleId: { type: String, required: true },
});

levelRoleSchema.index({ guildId: 1, level: 1 }, { unique: true });

export const Level = mongoose.model("Level", levelSchema);
export const LevelRole = mongoose.model("LevelRole", levelRoleSchema);
