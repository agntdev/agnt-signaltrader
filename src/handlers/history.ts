import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { displaySignal, isAdmin, state } from "../signal-domain.js";

// SCAFFOLD — generated from the bot blueprint BEFORE the agent runs.
// Keep a LIVE registration (.command / .callbackQuery / …) so this feature is
// never an empty stub. Replace the reply body with real logic + copy; if you
// change the user-facing text, update tests/specs to match EXACTLY.
// Do NOT rewrite src/bot.ts — buildBot() already auto-loads this module.

registerMainMenuItem({ label: "Execution history", data: "history:show", order: 40 });
const composer = new Composer<Ctx>();

async function text(ctx: Ctx): Promise<string> {
  const current = await state(ctx);
  if (!current.executionHistory.length) return "No executions yet — configured signals will appear here.";
  return current.executionHistory.slice(-10).reverse().map((item) => {
    const trade = item.parsedSignal ? displaySignal(item.parsedSignal) : "Unparsable signal";
    return `${item.executionStatus === "executed" ? "Executed" : item.executionStatus === "invalid" ? "Skipped" : "Failed"}: ${trade}.`;
  }).join("\n");
}
async function allowed(ctx: Ctx): Promise<boolean> { const current = await state(ctx); return isAdmin(ctx, current); }

composer.command("history", async (ctx) => {
  if (!(await allowed(ctx))) return void (await ctx.reply("This history belongs to the bot owner."));
  await ctx.reply(await text(ctx), { reply_markup: inlineKeyboard([[inlineButton("Back to menu", "menu:main")]]) });
});
composer.callbackQuery("history:show", async (ctx) => { await ctx.answerCallbackQuery(); if (!(await allowed(ctx))) return void (await ctx.editMessageText("This history belongs to the bot owner.")); await ctx.editMessageText(await text(ctx), { reply_markup: inlineKeyboard([[inlineButton("Back to menu", "menu:main")]]) }); });

export default composer;
