import { InlineKeyboard } from 'grammy';
import type { MyContext } from '../bot.js';
import type { Game, RoundData } from '../lib/types';
export declare function buildMainMenu(ctx: MyContext, games: RoundData): Promise<InlineKeyboard>;
export declare function buildRoundMenu(ctx: MyContext, games: Game[], userPredictions: number[]): InlineKeyboard;
export declare const buildMenuButton: (ctx: MyContext) => InlineKeyboard;
//# sourceMappingURL=build-menus.d.ts.map