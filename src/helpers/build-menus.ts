import { InlineKeyboard } from 'grammy'
import type { MyContext } from '../bot/index.js'
import type { Game } from '../../lib/types.js'

export function buildMainMenu(ctx: MyContext) {
	return new InlineKeyboard()
		.text(ctx.t('predict'), 'predict')
		.row()
		.text(ctx.t('leaderboard'), 'leaderboard')
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

export const menuButtonMarkup = (ctx: MyContext) =>
	new InlineKeyboard().text(ctx.t('menu'), 'menu')
