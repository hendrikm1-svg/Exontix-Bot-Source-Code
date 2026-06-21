import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import guildsRouter from "./api/guilds";
import guildRouter from "./api/guild";
import settingsRouter from "./api/settings";
import automodRouter from "./api/automod";
import ticketsRouter from "./api/tickets";
import welcomeRouter from "./api/welcome";
import rolesRouter from "./api/roles";
import logsRouter from "./api/logs";
import levelsRouter from "./api/levels";
import { apiLimiter } from "../middlewares/rateLimit";

const router: IRouter = Router();

router.use("/healthz", healthRouter);
router.use("/auth", authRouter);

// Apply rate limiting to all API routes
router.use(apiLimiter);

router.use("/guilds", guildsRouter);
router.use("/guild", guildRouter);
router.use("/settings", settingsRouter);
router.use("/automod", automodRouter);
router.use("/tickets", ticketsRouter);
router.use("/welcome", welcomeRouter);
router.use("/roles", rolesRouter);
router.use("/logs", logsRouter);
router.use("/levels", levelsRouter);

export default router;
