import { describe, expect, it } from "vitest";
import { buildBot } from "../src/bot.js";
import { MemorySessionStorage } from "../src/toolkit/index.js";

const botInfo = { id: 42, is_bot: true, first_name: "TestBot", username: "test_bot", can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false } as const;
let updateId = 0;
const privateUpdate = (text: string) => ({ update_id: ++updateId, message: { message_id: updateId, date: 0, chat: { id: 1, type: "private", first_name: "Owner" }, from: { id: 1, is_bot: false, first_name: "Owner" }, text, ...(text.startsWith("/") ? { entities: [{ type: "bot_command", offset: 0, length: text.length }] } : {}) } });
const callback = (data: string) => ({ update_id: ++updateId, callback_query: { id: String(updateId), from: { id: 1, is_bot: false, first_name: "Owner" }, message: { message_id: updateId, date: 0, chat: { id: 1, type: "private", first_name: "Owner" }, text: "menu" }, chat_instance: "test", data } });
const channelSignal = () => ({ update_id: ++updateId, channel_post: { message_id: updateId, date: 0, chat: { id: -100123, type: "channel", title: "Signals" }, from: { id: 1, is_bot: false, first_name: "Owner" }, text: "EURUSD BUY 0.10 SL 1.0800 TP 1.0900" } });

describe("signal processing", () => {
  it("uses persisted configuration to execute and record an approved channel signal", async () => {
    const storage = new MemorySessionStorage<any>();
    const bot = await buildBot("test-token", { storage });
    bot.botInfo = botInfo as any;
    const calls: Array<{ method: string; payload: any }> = [];
    bot.api.config.use(async (_prev, method, payload) => { calls.push({ method, payload }); return { ok: true, result: true } as any; });
    const oldUrl = process.env.METATRADER_BRIDGE_URL;
    const oldFetch = globalThis.fetch;
    process.env.METATRADER_BRIDGE_URL = "https://bridge.example";
    globalThis.fetch = async () => new Response('{"accepted":true}', { status: 201 });
    try {
      await bot.handleUpdate(privateUpdate("/start") as any);
      await bot.handleUpdate(callback("config:channels") as any);
      await bot.handleUpdate(callback("channels:add") as any);
      await bot.handleUpdate(privateUpdate("-100123") as any);
      await bot.handleUpdate(callback("config:posters") as any);
      await bot.handleUpdate(callback("posters:add") as any);
      await bot.handleUpdate(privateUpdate("1") as any);
      await bot.handleUpdate(channelSignal() as any);
      await bot.handleUpdate(privateUpdate("/history") as any);
    } finally {
      if (oldUrl === undefined) delete process.env.METATRADER_BRIDGE_URL;
      else process.env.METATRADER_BRIDGE_URL = oldUrl;
      globalThis.fetch = oldFetch;
    }
    expect(calls.some((call) => call.method === "sendMessage" && call.payload.text === "Trade executed: BUY 0.1 EURUSD.")).toBe(true);
    expect(calls.some((call) => call.method === "sendMessage" && call.payload.text === "Executed: BUY 0.1 EURUSD.")).toBe(true);
  });
});
