import { Router, type Request, type Response } from "express";

const router = Router();

const CLIENT_ID = process.env.CLIENT_ID!;
const CLIENT_SECRET = process.env.CLIENT_SECRET!;
const DASHBOARD_URL = process.env.DASHBOARD_URL!;
const REDIRECT_URI = `${DASHBOARD_URL}/auth/callback`;

router.get("/url", (_req: Request, res: Response) => {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: "identify guilds",
  });
  res.json({ url: `https://discord.com/oauth2/authorize?${params.toString()}` });
});

router.post("/exchange", async (req: Request, res: Response) => {
  const { code } = req.body as { code: string };

  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });

  const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };

  if (!tokenRes.ok) {
    res.status(401).json(tokenData);
    return;
  }

  const accessToken = tokenData.access_token!;

  const userRes = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const user = await userRes.json();
  res.json({ accessToken, user });
});

export default router;
