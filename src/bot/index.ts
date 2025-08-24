import { I18n, type I18nFlavor } from '@grammyjs/i18n'
import { PostgrestError } from '@supabase/supabase-js'
import {
	Bot,
	Context,
	InlineKeyboard,
	MemorySessionStorage,
	session,
	type SessionFlavor,
} from 'grammy'
import getData from '../harvest-data.js'
import { buildMainMenu, buildRoundMenu } from '../helpers/build-menus.js'
import { parseGameId } from '../helpers/parse-game-id.js'
import { sanitizeScore } from '../helpers/parse-score.js'
import { getLeaderboard, getPredictionsByUser } from '../supabase-client.js'
import type { Game } from '../types.js'
import { saveUserPrediction } from './save-prediction.js'
import { BASE_URL } from '../urls.js'

const token = process.env.TELEGRAM_BOT_TOKEN
if (!token) throw new Error('TELEGRAM_BOT_TOKEN is missing')
const bot = new Bot<MyContext>(token)
const games = await getData()

const round = 1

const i18n = new I18n<MyContext>({
	defaultLocale: 'ru',
	directory: 'src/locales',
})

const menu = new InlineKeyboard()
const roundMenu = new InlineKeyboard()

bot
	.use(
		session({
			initial: (): SessionData => ({ game: undefined }),
			storage: new MemorySessionStorage(),
		})
	)
	.use(i18n)

bot.command('start', (ctx) => {
	menu
		.text(ctx.t('predict'), 'predict')
		.row()
		.text(ctx.t('leaderboard'), 'leaderboard')
	ctx.reply(ctx.t('start'), { reply_markup: menu })
})

bot.callbackQuery('predict', async (ctx) => {
	const usersPredictions = await getPredictionsByUser(ctx.from.id, 1)

	const gamesWithPrediction: Game[] = []
	const gamesWithoutPrediction: Game[] = []

	games.games.forEach((game) => {
		const hasPrediction = usersPredictions.some((p) => p.game_id === game.id)
		if (hasPrediction) {
			gamesWithPrediction.push(game)
		} else {
			gamesWithoutPrediction.push(game)
		}
	})

	gamesWithoutPrediction.forEach(({ id, home, away }) => {
		roundMenu.text(`${home.team} — ${away.team}`, `game_${id}`)
		roundMenu.row()
	})

	roundMenu.text(ctx.t('menu'), 'menu')

	await ctx.answerCallbackQuery()
	if (!!gamesWithoutPrediction.length)
		await ctx.editMessageText(ctx.t('match_select'), {
			reply_markup: buildRoundMenu(
				ctx,
				games.games,
				usersPredictions.map((p) => p.game_id)
			),
		})
	if (!!usersPredictions.length)
		await ctx.reply(
			`${ctx.t('predicted')}\n\n${usersPredictions
				.map(
					({ home_team, away_team, home_goals, away_goals }) =>
						`${home_team} – ${away_team} → ${home_goals}:${away_goals}`
				)
				.join('\n')}`
		)
})

bot.on('callback_query:data', async (ctx) => {
	const data = ctx.callbackQuery.data
	if (data.startsWith('game_')) {
		await ctx.answerCallbackQuery()

		const game = games.games.find((game) => game.id === parseGameId(data))

		ctx.session.game = game

		await ctx.replyWithMediaGroup([
			{
				type: 'photo',
				media: `${BASE_URL}/${game?.home.logo!}`,
				caption: `${ctx.t('match')} ${game?.home.team} - ${game?.away.team}?`,
			},
			{
				type: 'photo',
				media: `${BASE_URL}/${game?.away.logo!}`,
			},
		])
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

	if (data === 'menu') {
		ctx.reply(ctx.t('start'), { reply_markup: buildMainMenu(ctx) })
	}
})

bot.on('message:text', async (ctx) => {
	const msg = ctx.message.text.trim()

	if (ctx.session.game) {
		const score = sanitizeScore(msg)
		const [homeGoals, awayGoals] = score.split('-')
		const { home, away, id } = ctx.session.game
		try {
			await saveUserPrediction(
				id,
				ctx,
				home.team!,
				away.team!,
				score,
				round
			).then(async () => {
				await ctx.reply(
					ctx.t('prediction_made', {
						n: '\n\n',
						home: home.team,
						away: away.team,
						homeGoals: homeGoals!,
						awayGoals: awayGoals!,
					}),
					{ parse_mode: 'MarkdownV2' }
				)
				const predicted = await getPredictionsByUser(ctx.from.id, 1).then(
					(data) => data.map((p) => p.game_id)
				)
				await ctx.reply(ctx.t('match_select'), {
					reply_markup: buildRoundMenu(ctx, games.games, predicted),
				})
			})
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
export type MyContext = Context & SessionFlavor<SessionData> & I18nFlavor
