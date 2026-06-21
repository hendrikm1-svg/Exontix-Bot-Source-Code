import { mongoose } from "../mongoose";

const economySchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    balance: { type: Number, default: 0 },
    bank: { type: Number, default: 0 },
    lastDaily: { type: Date },
    totalEarned: { type: Number, default: 0 },
  },
  { timestamps: true },
);

economySchema.index({ guildId: 1, userId: 1 }, { unique: true });

export const Economy = mongoose.model("Economy", economySchema);
