import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { begin, clear, flowActive, isAdmin, save, state } from "../signal-domain.js";

// SCAFFOLD — generated from the bot blueprint BEFORE the agent runs.
// Keep a LIVE registration (.command / .callbackQuery / …) so this feature is
// never an empty stub. Replace the reply body with real logic + copy; if you
// change the user-facing text, update tests/specs to match EXACTLY.
// Do NOT rewrite src/bot.ts — buildBot() already auto-loads this module.
// Menu: wire this into /start via registerMainMenuItem({ label: "Manage Posters", data: "config:posters" }) if the toolkit exposes it.

registerMainMenuItem({ label: "Manage posters", data: "config:posters", order: 20 });
const composer = new Composer<Ctx>();
const keyboard = inlineKeyboard([[inlineButton("Approve poster", "posters:add"), inlineButton("Revoke poster", "posters:remove")], [inlineButton("Back to menu", "menu:main")]]);
async function show(ctx: Ctx) { const current = await state(ctx); const names = current.posters.filter((item) => item.approvalStatus).map((item) => item.username ?? "approved poster").join(", "); await ctx.editMessageText(names ? `Approved posters: ${names}.` : "No approved posters yet — tap Approve poster to add one.", { reply_markup: keyboard }); }

composer.callbackQuery("config:posters", async (ctx) => {
  await ctx.answerCallbackQuery();
  const current = await state(ctx); if (!isAdmin(ctx, current)) return void (await ctx.editMessageText("This admin menu belongs to the bot owner.")); await show(ctx);
});
composer.callbackQuery("posters:add", async (ctx) => { await ctx.answerCallbackQuery(); begin(ctx, "poster:add"); await ctx.editMessageText("Send the poster’s @username or numeric Telegram ID.", { reply_markup: inlineKeyboard([[inlineButton("Cancel", "posters:cancel")]]) }); });
composer.callbackQuery("posters:remove", async (ctx) => { await ctx.answerCallbackQuery(); begin(ctx, "poster:remove"); await ctx.editMessageText("Send the poster’s @username or numeric Telegram ID to revoke.", { reply_markup: inlineKeyboard([[inlineButton("Cancel", "posters:cancel")]]) }); });
composer.callbackQuery("posters:cancel", async (ctx) => { await ctx.answerCallbackQuery(); clear(ctx); await show(ctx); });
composer.on("message:text", async (ctx, next) => {
  if (!flowActive(ctx) || (ctx.session.step !== "poster:add" && ctx.session.step !== "poster:remove")) return next();
  const current = await state(ctx); if (!isAdmin(ctx, current)) return;
  const input = ctx.message.text.trim(); if (!/^@[A-Za-z0-9_]{5,32}$/.test(input) && !/^\d{1,20}$/.test(input)) { await ctx.reply("That poster reference doesn’t look right. Send an @username or numeric Telegram ID."); return; }
  const key = input.toLowerCase();
  if (ctx.session.step === "poster:add") { current.posters = current.posters.filter((item) => item.posterId !== key); current.posters.push({ posterId: key, ...(input.startsWith("@") ? { username: input } : {}), approvalStatus: true }); await save(ctx, current); clear(ctx); await ctx.reply("Poster approval is on."); }
  else { const before = current.posters.length; current.posters = current.posters.filter((item) => item.posterId !== key); await save(ctx, current); clear(ctx); await ctx.reply(before === current.posters.length ? "That poster wasn’t approved." : "Poster approval is off."); }
});

export default composer;
