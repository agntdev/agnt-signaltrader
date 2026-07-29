import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { begin, clear, flowActive, isAdmin, save, state } from "../signal-domain.js";

registerMainMenuItem({ label: "Parsing rules", data: "config:rules", order: 30 });
const composer = new Composer<Ctx>();
const back = inlineKeyboard([[inlineButton("Back to menu", "menu:main")]]);

composer.callbackQuery("config:rules", async (ctx) => {
  await ctx.answerCallbackQuery(); const current = await state(ctx);
  if (!isAdmin(ctx, current)) return void (await ctx.editMessageText("This admin menu belongs to the bot owner."));
  const scope = current.allowedSymbols.length ? current.allowedSymbols.join(", ") : "all symbols";
  await ctx.editMessageText(`Signals use: SYMBOL BUY or SELL SIZE, with optional SL, TP, and EXPIRY.\n\nAllowed symbols: ${scope}.`, { reply_markup: inlineKeyboard([[inlineButton("Set allowed symbols", "rules:set")], [inlineButton("Allow all symbols", "rules:all")], [inlineButton("Back to menu", "menu:main")]]) });
});
composer.callbackQuery("rules:set", async (ctx) => { await ctx.answerCallbackQuery(); begin(ctx, "rules:set"); await ctx.editMessageText("Send the symbols to allow, separated by commas. Example: EURUSD, XAUUSD.", { reply_markup: inlineKeyboard([[inlineButton("Cancel", "rules:cancel")]]) }); });
composer.callbackQuery("rules:all", async (ctx) => { await ctx.answerCallbackQuery(); const current = await state(ctx); if (!isAdmin(ctx, current)) return; current.allowedSymbols = []; await save(ctx, current); await ctx.editMessageText("Signals for all symbols are allowed.", { reply_markup: back }); });
composer.callbackQuery("rules:cancel", async (ctx) => { await ctx.answerCallbackQuery(); clear(ctx); await ctx.editMessageText("No parsing rules were changed.", { reply_markup: back }); });
composer.on("message:text", async (ctx, next) => {
  if (!flowActive(ctx) || ctx.session.step !== "rules:set") return next();
  const current = await state(ctx); if (!isAdmin(ctx, current)) return;
  const symbols = [...new Set(ctx.message.text.toUpperCase().split(",").map((part) => part.trim()).filter((part) => /^[A-Z]{3,12}$/.test(part)))];
  if (!symbols.length) { await ctx.reply("Send one or more symbols, separated by commas."); return; }
  current.allowedSymbols = symbols; await save(ctx, current); clear(ctx); await ctx.reply(`Parsing rules now allow: ${symbols.join(", ")}.`);
});
export default composer;
