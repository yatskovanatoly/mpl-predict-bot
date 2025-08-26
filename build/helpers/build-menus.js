import { InlineKeyboard } from 'grammy';
import { getPredictionsByUser } from '../lib/supabase-client';
export async function buildMainMenu(ctx, games) {
    const kb = new InlineKeyboard();
    kb.text(ctx.t('predict'), 'predict').row();
    const prevRound = games.round - 1;
    if (games.round > 1) {
        const usersPredictions = await getPredictionsByUser(ctx.from.id, prevRound);
        if (!!usersPredictions.length)
            kb.text(ctx.t('prev', { n: prevRound }), 'prev').row();
    }
    kb.text(ctx.t('leaderboard'), 'leaderboard');
    return kb;
}
export function buildRoundMenu(ctx, games, userPredictions) {
    const kb = new InlineKeyboard();
    games.forEach(({ id, home, away }) => {
        if (!userPredictions.includes(id)) {
            kb.text(`${home.team} — ${away.team}`, `game_${id}`).row();
        }
    });
    kb.text(ctx.t('menu'), 'menu');
    return kb;
}
export const buildMenuButton = (ctx) => new InlineKeyboard().text(ctx.t('menu'), 'menu');
//# sourceMappingURL=build-menus.js.map