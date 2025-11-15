import { addHours } from 'date-fns'
import { MyContext } from '../bot/index.ts'
import { Game } from '../lib/types.ts'
import { buildMenuButton } from './build-menus.ts'

const ensurePredictionsOpen = async (ctx: MyContext, games: Game[]) => {
	const matchDate = new Date(games[0].date)
	const now = addHours(new Date(), 3)
	const isPastMatchDay = matchDate <= now

	if (isPastMatchDay) {
		await ctx.answerCallbackQuery()
		return ctx.editMessageText(ctx.t('prediction_closed'), {
			reply_markup: buildMenuButton(ctx),
		})
	}
	return null
}

export default ensurePredictionsOpen
