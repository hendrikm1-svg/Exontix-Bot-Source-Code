import type { Command } from "../client";
import { banCommand } from "./moderation/ban";
import { kickCommand } from "./moderation/kick";
import { timeoutCommand } from "./moderation/timeout";
import { warnCommand } from "./moderation/warn";
import { unwarnCommand } from "./moderation/unwarn";
import { clearCommand } from "./moderation/clear";
import { lockCommand } from "./moderation/lock";
import { unlockCommand } from "./moderation/unlock";
import { ticketCommand } from "./tickets/ticket";
import { verifyCommand } from "./verify/verify";
import { leaderboardCommand } from "./levels/leaderboard";
import { rankCommand } from "./levels/rank";
import { balanceCommand } from "./economy/balance";
import { dailyCommand } from "./economy/daily";
import { abspielenCommand } from "./music/abspielen";
import { stoppCommand } from "./music/stopp";
import { ueberspringenCommand } from "./music/ueberspringen";
import { warteschlangeCommand } from "./music/warteschlange";
import { suchenCommand } from "./music/suchen";
import { loopCommand } from "./music/loop";

export const commands: Command[] = [
  banCommand,
  kickCommand,
  timeoutCommand,
  warnCommand,
  unwarnCommand,
  clearCommand,
  lockCommand,
  unlockCommand,
  ticketCommand,
  verifyCommand,
  leaderboardCommand,
  rankCommand,
  balanceCommand,
  dailyCommand,
  // Musik
  abspielenCommand,
  stoppCommand,
  ueberspringenCommand,
  warteschlangeCommand,
  suchenCommand,
  loopCommand,
];
