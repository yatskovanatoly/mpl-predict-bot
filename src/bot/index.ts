import {
	Bot,
	Context,
	GrammyError,
	InlineKeyboard,
	MemorySessionStorage,
	session,
	type SessionFlavor,
} from 'grammy'
import getData from '../harvest-data.js'
import { sanitizeScore } from '../parse-score.js'
import { getLeaderboard } from '../supabase-client.js'
import type { Game } from '../types.js'
import { saveUserPrediction } from './save-prediction.js'
import { I18n, type I18nFlavor } from '@grammyjs/i18n'
import { PostgrestError } from '@supabase/supabase-js'

const token = process.env.TELEGRAM_BOT_TOKEN
if (!token) throw new Error('TELEGRAM_BOT_TOKEN is missing')
const bot = new Bot<MyContext>(token)
const games = await getData()

const i18n = new I18n<MyContext>({
	defaultLocale: 'ru',
	directory: 'src/locales',
})

bot
	.use(
		session({
			initial: (): SessionData => ({ game: undefined }),
			storage: new MemorySessionStorage(),
		})
	)
	.use(i18n)

bot.command('start', (ctx) => {
	const menu = new InlineKeyboard()
		.text(ctx.t('predict'), 'predict')
		.row()
		.text(ctx.t('leaderboard'), 'leaderboard')
	ctx.reply(ctx.t('start'), { reply_markup: menu })
})

bot.callbackQuery('predict', async (ctx) => {
	const roundMenu = new InlineKeyboard()
	games.games.forEach(({ id, home, away }) => {
		roundMenu.text(`${home.team} — ${away.team}`, `${id}`)
		roundMenu.row()
	})
	await ctx.answerCallbackQuery()
	await ctx.editMessageText(ctx.t('match_select'), {
		reply_markup: roundMenu,
	})
})

bot.on('callback_query:data', async (ctx) => {
	const data = ctx.callbackQuery.data
	if (data.startsWith('game_')) {
		await ctx.answerCallbackQuery()

		const game = games.games.find((game) => game.id === data)

		ctx.session.game = game

		await ctx.reply(
			`${ctx.t('match')} ${game?.home.team} - ${game?.away.team}?`
		)
	}

	if (data === 'leaderboard') {
		try {
			const leaderboard = await getLeaderboard()
			if (!leaderboard || leaderboard.length === 0) {
				await ctx.reply(ctx.t('leaderboard_empty'))
				return
			}

			let table = `${ctx.t('leaderboard_view')}\n\n`
			leaderboard.forEach((p, i) => {
				table += `${i + 1}. ${p.username} — ${p.points} pts\n`
			})

			await ctx.reply(table)
			return
		} catch (err) {
			console.error(err)
			await ctx.reply(ctx.t('leaderboard_fail'))
			return
		}
	}
})

bot.on('message:text', async (ctx) => {
	const msg = ctx.message.text.trim()

	if (ctx.session.game) {
		const score = sanitizeScore(msg)
		const [homeGoals, awayGoals] = score.split('-')
		const { home, away, id } = ctx.session.game
		try {
			await saveUserPrediction(id, ctx.from, home.team!, away.team!, score)
			await ctx.reply(
				ctx.t('prediction_made', {
					home: home.team,
					away: away.team,
					homeGoals: homeGoals!,
					awayGoals: awayGoals!,
				}),
				{ parse_mode: 'MarkdownV2' }
			)
			return (ctx.session.game = undefined)
		} catch (err) {
			console.error(err)
			const errMessage = err as PostgrestError
			await ctx.reply(
				ctx.t('prediction_fail', {
					err: errMessage.message,
				}),
				{
					parse_mode: 'HTML',
				}
			)
		}
	}

	// Fallback
	await ctx.reply(ctx.t('fallback'))
})

bot.start()

type SessionData = { game: Game | undefined }
type MyContext = Context & SessionFlavor<SessionData> & I18nFlavor
