import { MyContext } from '../bot/index.ts'
import { logosMap } from '../lib/logos-by-id.ts'
import { Game } from '../lib/types.ts'
import { FALLBACK_IMG } from '../lib/urls.ts'

export const buildMatchMessage = async (ctx: MyContext, game: Game) =>
	await ctx.replyWithMediaGroup([
		{
			type: 'photo',
			media: logosMap[game.home_id] || FALLBACK_IMG,
			caption: `${ctx.t('match')} ${game?.home} - ${game?.away}?`,
		},
		{
			type: 'photo',
			media: logosMap[game.away_id] || FALLBACK_IMG,
		},
	])
