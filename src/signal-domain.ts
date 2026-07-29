import type { Ctx } from "./bot.js";

export interface SignalSource { channelId: string; label: string; monitoringStatus: boolean }
export interface ApprovedPoster { posterId: string; username?: string; approvalStatus: boolean }
export interface ParsedSignal {
  symbol: string; side: "BUY" | "SELL"; size: number; stopLoss?: number; takeProfit?: number; expiry?: string;
}
export interface ExecutionRecord {
  timestamp: string; signalSource: string; parsedSignal?: ParsedSignal; executionStatus: "executed" | "failed" | "invalid";
  brokerResponse: string;
}
export interface SignalTraderState {
  adminChatId?: number;
  channels: SignalSource[];
  posters: ApprovedPoster[];
  executionHistory: ExecutionRecord[];
  allowedSymbols: string[];
}

const KEY = "signaltrader:state";
const empty = (): SignalTraderState => ({ channels: [], posters: [], executionHistory: [], allowedSymbols: [] });

export async function state(ctx: Ctx): Promise<SignalTraderState> {
  return (await ctx.store.read<SignalTraderState>(KEY)) ?? empty();
}
export async function save(ctx: Ctx, value: SignalTraderState): Promise<void> { await ctx.store.write(KEY, value); }
let clock: () => Date = () => new Date();
/** Injectable clock seam for expiry and execution timestamps. */
export function now(): Date { return clock(); }
export function setClockForTests(next: (() => Date) | undefined): void { clock = next ?? (() => new Date()); }
export function flowActive(ctx: Ctx): boolean {
  return Boolean(ctx.session.step && ctx.session.flowExpiresAt && ctx.session.flowExpiresAt > now().getTime());
}
export function begin(ctx: Ctx, step: NonNullable<Ctx["session"]["step"]>): void {
  ctx.session.step = step;
  ctx.session.flowExpiresAt = now().getTime() + 10 * 60 * 1000;
}
export function clear(ctx: Ctx): void { ctx.session.step = undefined; ctx.session.flowExpiresAt = undefined; }
export function isAdmin(ctx: Ctx, value: SignalTraderState): boolean {
  return value.adminChatId === undefined || value.adminChatId === ctx.chat?.id;
}
export function parseSignal(text: string, allowedSymbols: string[]): ParsedSignal | undefined {
  const upper = text.toUpperCase().replace(/,/g, " ");
  const main = /\b([A-Z]{3,12})\s+(BUY|SELL)\s+([0-9]+(?:\.[0-9]+)?)/.exec(upper);
  if (!main) return undefined;
  const symbol = main[1];
  if (allowedSymbols.length && !allowedSymbols.includes(symbol)) return undefined;
  const size = Number(main[3]);
  if (!Number.isFinite(size) || size <= 0) return undefined;
  const numberAfter = (name: string) => new RegExp(`\\b${name}\\s*[:=]?\\s*([0-9]+(?:\\.[0-9]+)?)`).exec(upper)?.[1];
  const expiry = /\b(?:EXP(?:IRY)?|UNTIL)\s*[:=]?\s*([^\n]+)/.exec(text)?.[1]?.trim();
  return { symbol, side: main[2] as "BUY" | "SELL", size, ...(numberAfter("SL") ? { stopLoss: Number(numberAfter("SL")) } : {}), ...(numberAfter("TP") ? { takeProfit: Number(numberAfter("TP")) } : {}), ...(expiry ? { expiry } : {}) };
}
export function displaySignal(signal: ParsedSignal): string { return `${signal.side} ${signal.size} ${signal.symbol}`; }
