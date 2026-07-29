import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { displaySignal, now, parseSignal, save, state, type ExecutionRecord, type ParsedSignal } from "../signal-domain.js";

const composer = new Composer<Ctx>();
const runtimeEnv = (ctx: Ctx): Record<string, string | undefined> => {
  const workerEnv = (ctx as Ctx & { env?: Record<string, string | undefined> }).env;
  return workerEnv ?? (typeof process === "undefined" ? {} : process.env);
};

function sourceMatches(ctx: Ctx, configured: { channelId: string }[]): boolean {
  const chat = ctx.chat; if (!chat) return false;
  const ids = [String(chat.id), "username" in chat && chat.username ? `@${chat.username}`.toLowerCase() : ""];
  return configured.some((item) => ids.includes(item.channelId));
}
function posterMatches(ctx: Ctx, configured: { posterId: string; username?: string }[]): boolean {
  const from = ctx.from; if (!from) return false;
  const ids = [String(from.id), from.username ? `@${from.username}`.toLowerCase() : ""];
  return configured.some((item) => ids.includes(item.posterId) || (item.username && ids.includes(item.username.toLowerCase())));
}
async function sendToAdmin(ctx: Ctx, chatId: number | undefined, text: string): Promise<void> {
  if (chatId === undefined) return;
  try { await ctx.api.sendMessage(chatId, text); } catch { /* A blocked owner must not stop signal processing. */ }
}
async function submit(ctx: Ctx, signal: ParsedSignal): Promise<{ ok: boolean; response: string; attempts: number }> {
  const env = runtimeEnv(ctx); const endpoint = env.METATRADER_BRIDGE_URL;
  if (!endpoint) return { ok: false, response: "MetaTrader bridge is not configured", attempts: 0 };
  const url = `${endpoint.replace(/\/$/, "")}/orders`;
  let last = "MetaTrader bridge did not accept the order";
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...(env.METATRADER_API_KEY ? { authorization: `Bearer ${env.METATRADER_API_KEY}` } : {}) }, body: JSON.stringify({ symbol: signal.symbol, side: signal.side, volume: signal.size, stop_loss: signal.stopLoss, take_profit: signal.takeProfit, expiry: signal.expiry }) });
      const body = await response.text();
      if (response.ok) return { ok: true, response: body.slice(0, 300) || "Order accepted", attempts: attempt };
      last = `Bridge returned HTTP ${response.status}`;
      if (response.status < 500 && response.status !== 429) break;
    } catch { last = "Could not reach the MetaTrader bridge"; }
  }
  return { ok: false, response: last, attempts: 2 };
}
async function processSignal(ctx: Ctx, text: string): Promise<void> {
  const current = await state(ctx);
  if (!sourceMatches(ctx, current.channels.filter((item) => item.monitoringStatus)) || !posterMatches(ctx, current.posters.filter((item) => item.approvalStatus))) return;
  const signal = parseSignal(text, current.allowedSymbols);
  const recordBase = { timestamp: now().toISOString(), signalSource: String(ctx.chat?.id ?? "channel") };
  let record: ExecutionRecord;
  if (!signal) {
    record = { ...recordBase, executionStatus: "invalid", brokerResponse: "Signal could not be parsed" };
    current.executionHistory.push(record);
    if (current.executionHistory.length > 200) current.executionHistory = current.executionHistory.slice(-200);
    await save(ctx, current);
    await sendToAdmin(ctx, current.adminChatId, "A signal was skipped because its trade details couldn’t be read."); return;
  }
  const result = await submit(ctx, signal);
  record = { ...recordBase, parsedSignal: signal, executionStatus: result.ok ? "executed" : "failed", brokerResponse: result.response };
  current.executionHistory.push(record);
  if (current.executionHistory.length > 200) current.executionHistory = current.executionHistory.slice(-200);
  await save(ctx, current);
  const failure = result.attempts === 0
    ? "Trade couldn’t be executed because the MetaTrader bridge isn’t set up yet."
    : `Trade couldn’t be executed after ${result.attempts} attempts. Check the MetaTrader bridge.`;
  await sendToAdmin(ctx, current.adminChatId, result.ok ? `Trade executed: ${displaySignal(signal)}.` : failure);
}
composer.on("channel_post:text", async (ctx) => { await processSignal(ctx, ctx.channelPost.text); });
export default composer;
