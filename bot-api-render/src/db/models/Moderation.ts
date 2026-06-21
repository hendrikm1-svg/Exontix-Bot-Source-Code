import { mongoose } from "../mongoose";

const warnSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    moderatorId: { type: String, required: true },
    reason: { type: String, default: "No reason provided" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

warnSchema.index({ guildId: 1, userId: 1 });

export const Warning = mongoose.model("Warning", warnSchema);
