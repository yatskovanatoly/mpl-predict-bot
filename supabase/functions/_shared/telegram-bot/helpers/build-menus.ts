import { InlineKeyboard } from 'https://deno.land/x/grammy@v1.38.1/mod.ts'
import { MyContext } from '../bot/index.ts'
import { getPredictionsByUser } from '../lib/supabase-client.ts'
import { Game } from '../lib/types.ts'

export async function buildMainMenu(ctx: MyContext, games: Game[]) {
	const kb = new InlineKeyboard()
	kb.text(ctx.t('predict'), 'predict').row()

	const prevRound = games[0].round - 1

	if (games[0].round > 1) {
		const usersPredictions = await getPredictionsByUser(ctx.from!.id, prevRound)

		if (usersPredictions.length)
			kb.text(ctx.t('prev', { n: prevRound }), 'prev').row()
	}

	kb.text(ctx.t('leaderboard'), 'leaderboard')

	return kb
}

export function buildRoundMenu(
	ctx: MyContext,
	games: Game[],
	userPredictions: number[]
) {
	const kb = new InlineKeyboard()

	games.forEach(({ game_id, home, away }) => {
		if (!userPredictions.includes(game_id)) {
			kb.text(`${home} — ${away}`, `game_${game_id}`).row()
		}
	})

	kb.text(ctx.t('menu'), 'menu')
	return kb
}

export const buildMenuButton = (ctx: MyContext) =>
	new InlineKeyboard().text(ctx.t('menu'), 'menu')
