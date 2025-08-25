import { InlineKeyboard } from 'grammy'
import type { MyContext } from '../bot/index.js'
import type { Game, RoundData } from '../../lib/types.js'
import { getPredictionsByUser } from '../../lib/supabase-client.js'

export async function buildMainMenu(ctx: MyContext, games: RoundData) {
	const kb = new InlineKeyboard()
	kb.text(ctx.t('predict'), 'predict').row()

	const prevRound = games.round - 1

	if (games.round > 1) {
		const usersPredictions = await getPredictionsByUser(ctx.from!.id, prevRound)

		if (!!usersPredictions.length)
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

	games.forEach(({ id, home, away }) => {
		if (!userPredictions.includes(id)) {
			kb.text(`${home.team} — ${away.team}`, `game_${id}`).row()
		}
	})

	kb.text(ctx.t('menu'), 'menu')
	return kb
}

export const buildMenuButton = (ctx: MyContext) =>
	new InlineKeyboard().text(ctx.t('menu'), 'menu')
