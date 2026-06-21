import type { Request, Response, NextFunction } from "express";

// Verify API secret header for dashboard → bot calls
export function requireApiSecret(req: Request, res: Response, next: NextFunction): void {
  const apiSecret = process.env["API_SECRET"];
  const provided = req.headers["x-api-secret"] as string | undefined;

  if (!apiSecret) {
    res.status(500).json({ error: "API_SECRET not configured" });
    return;
  }

  if (!provided || provided !== apiSecret) {
    res.status(401).json({ error: "Unauthorized: invalid API secret" });
    return;
  }

  next();
}

// Verify Discord OAuth token (Bearer token from dashboard)
export async function requireDiscordAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized: missing Bearer token" });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const userRes = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!userRes.ok) {
      res.status(401).json({ error: "Unauthorized: invalid Discord token" });
      return;
    }

    const user = (await userRes.json()) as { id: string; username: string; discriminator: string; avatar: string | null };
    (req as Request & { discordUser: typeof user }).discordUser = user;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized: could not validate token" });
  }
}

// Check that the authenticated user has ADMINISTRATOR permission in the guild
export async function requireGuildAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = authHeader.slice(7);
  const guildId = req.params["guildId"] ?? (req.body as { guildId?: string }).guildId;

  if (!guildId) {
    res.status(400).json({ error: "guildId required" });
    return;
  }

  try {
    const memberRes = await fetch(
      `https://discord.com/api/v10/users/@me/guilds`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!memberRes.ok) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const guilds = (await memberRes.json()) as Array<{ id: string; permissions: string }>;
    const guild = guilds.find((g) => g.id === guildId);

    if (!guild) {
      res.status(403).json({ error: "You are not in this guild" });
      return;
    }

    // ADMINISTRATOR = 0x8
    const perms = BigInt(guild.permissions);
    if (!(perms & BigInt(0x8))) {
      res.status(403).json({ error: "Administrator permission required" });
      return;
    }

    next();
  } catch {
    res.status(401).json({ error: "Could not verify permissions" });
  }
}
