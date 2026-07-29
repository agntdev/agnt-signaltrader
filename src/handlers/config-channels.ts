import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { begin, clear, flowActive, isAdmin, save, state } from "../signal-domain.js";

// SCAFFOLD — generated from the bot blueprint BEFORE the agent runs.
// Keep a LIVE registration (.command / .callbackQuery / …) so this feature is
// never an empty stub. Replace the reply body with real logic + copy; if you
// change the user-facing text, update tests/specs to match EXACTLY.
// Do NOT rewrite src/bot.ts — buildBot() already auto-loads this module.
// Menu: wire this into /start via registerMainMenuItem({ label: "Configure Channels", data: "config:channels" }) if the toolkit exposes it.

registerMainMenuItem({ label: "Configure channels", data: "config:channels", order: 10 });
const composer = new Composer<Ctx>();

const keyboard = inlineKeyboard([
  [inlineButton("Add channel", "channels:add"), inlineButton("Remove channel", "channels:remove")],
  [inlineButton("Back to menu", "menu:main")],
]);

async function show(ctx: Ctx, edit = true) {
  const current = await state(ctx);
  const list = current.channels.filter((item) => item.monitoringStatus).map((item) => item.label).join(", ");
  const text = list ? `Monitoring: ${list}.` : "No channels are monitored yet — tap Add channel to set one up.";
  if (edit) await ctx.editMessageText(text, { reply_markup: keyboard });
  else await ctx.reply(text, { reply_markup: keyboard });
}

composer.callbackQuery("config:channels", async (ctx) => {
  await ctx.answerCallbackQuery();
  const current = await state(ctx);
  if (!isAdmin(ctx, current)) return void (await ctx.editMessageText("This admin menu belongs to the bot owner."));
  await show(ctx);
});

composer.callbackQuery("channels:add", async (ctx) => {
  await ctx.answerCallbackQuery(); begin(ctx, "channel:add");
  await ctx.editMessageText("Send the channel @username or numeric channel ID to monitor.", { reply_markup: inlineKeyboard([[inlineButton("Cancel", "channels:cancel")]]) });
});
composer.callbackQuery("channels:remove", async (ctx) => {
  await ctx.answerCallbackQuery(); begin(ctx, "channel:remove");
  await ctx.editMessageText("Send the channel @username or numeric channel ID to stop monitoring.", { reply_markup: inlineKeyboard([[inlineButton("Cancel", "channels:cancel")]]) });
});
composer.callbackQuery("channels:cancel", async (ctx) => { await ctx.answerCallbackQuery(); clear(ctx); await show(ctx); });
composer.on("message:text", async (ctx, next) => {
  if (!flowActive(ctx) || (ctx.session.step !== "channel:add" && ctx.session.step !== "channel:remove")) return next();
  const current = await state(ctx); if (!isAdmin(ctx, current)) return;
  const input = ctx.message.text.trim();
  if (!/^@[A-Za-z0-9_]{5,32}$/.test(input) && !/^-?\d{5,20}$/.test(input)) { await ctx.reply("That channel reference doesn’t look right. Send an @username or numeric channel ID."); return; }
  const key = input.toLowerCase();
  if (ctx.session.step === "channel:add") {
    if (current.channels.some((item) => item.channelId === key && item.monitoringStatus)) { clear(ctx); await ctx.reply("That channel is already being monitored."); return; }
    current.channels = current.channels.filter((item) => item.channelId !== key);
    current.channels.push({ channelId: key, label: input.startsWith("@") ? input : "a private channel", monitoringStatus: true });
    await save(ctx, current); clear(ctx); await ctx.reply("Channel monitoring is on.");
  } else {
    const before = current.channels.length;
    current.channels = current.channels.filter((item) => item.channelId !== key);
    await save(ctx, current); clear(ctx); await ctx.reply(before === current.channels.length ? "That channel wasn’t being monitored." : "Channel monitoring is off.");
  }
});

export default composer;
