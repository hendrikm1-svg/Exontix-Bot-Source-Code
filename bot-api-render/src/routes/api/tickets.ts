import { Router } from "express";
import { requireDiscordAuth, requireGuildAdmin } from "../../middlewares/auth";
import { TicketConfig, Ticket } from "../../db/models/Ticket";
import { emitToGuild } from "../../websocket/server";

const router = Router();

router.get("/config/:guildId", requireDiscordAuth, requireGuildAdmin, async (req, res) => {
  try {
    const { guildId } = req.params;
    const config = await TicketConfig.findOneAndUpdate(
      { guildId },
      { $setOnInsert: { guildId } },
      { upsert: true, new: true },
    );
    // Return supportRoleId (single) for dashboard compatibility
    const configObj = config.toObject();
    res.json({ ...configObj, supportRoleId: configObj.supportRoles?.[0] ?? null });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/update", requireDiscordAuth, requireGuildAdmin, async (req, res) => {
  try {
    const { guildId, supportRoleId, ...rest } = req.body as { guildId: string; supportRoleId?: string; [k: string]: unknown };
    if (!guildId) { res.status(400).json({ error: "guildId required" }); return; }

    // Dashboard sends supportRoleId (single), DB stores supportRoles (array)
    const updates: Record<string, unknown> = { ...rest };
    if (supportRoleId !== undefined) {
      updates["supportRoles"] = supportRoleId ? [supportRoleId] : [];
    }

    const config = await TicketConfig.findOneAndUpdate(
      { guildId },
      { $set: updates },
      { upsert: true, new: true },
    );

    // Return config with supportRoleId for dashboard compatibility
    const configObj = config.toObject();
    const responseConfig = {
      ...configObj,
      supportRoleId: configObj.supportRoles?.[0] ?? null,
    };

    emitToGuild(guildId, "tickets:updated", responseConfig);
    res.json({ success: true, config: responseConfig });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:guildId/list", requireDiscordAuth, requireGuildAdmin, async (req, res) => {
  try {
    const { guildId } = req.params;
    const page = Number(req.query["page"] ?? 1);
    const limit = Math.min(Number(req.query["limit"] ?? 20), 100);
    const statusParam = req.query["status"];
    const rawStatus = typeof statusParam === "string" ? statusParam : Array.isArray(statusParam) && typeof statusParam[0] === "string" ? statusParam[0] as string : undefined;

    const validStatuses = ["open", "closed", "deleted"] as const;
    type TicketStatus = (typeof validStatuses)[number];
    const typedStatus: TicketStatus | undefined = rawStatus && (validStatuses as readonly string[]).includes(rawStatus)
      ? (rawStatus as TicketStatus)
      : undefined;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: Record<string, any> = { guildId: guildId as string };
    if (typedStatus) query["status"] = typedStatus;

    const [tickets, total] = await Promise.all([
      Ticket.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Ticket.countDocuments(query),
    ]);

    res.json({ tickets, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
