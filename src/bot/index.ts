import { I18n, type I18nFlavor } from '@grammyjs/i18n'
import { PostgrestError } from '@supabase/supabase-js'
import {
	Bot,
	Context,
	InlineKeyboard,
	InputFile,
	MemorySessionStorage,
	session,
	type SessionFlavor,
} from 'grammy'
import getData from '../../lib/harvest-data.js'
import { logosMap } from '../../lib/logos-by-id.js'
import {
	getLeaderboard,
	getPredictionsByUser,
} from '../../lib/supabase-client.js'
import type { Game } from '../../lib/types.js'
import {
	buildMainMenu,
	buildRoundMenu,
	menuButtonMarkup,
} from '../helpers/build-menus.js'
import { editHelper } from '../helpers/edit-helper.js'
import { parseGameId } from '../helpers/parse-game-id.js'
import { sanitizeScore } from '../helpers/parse-score.js'
import { saveUserPrediction } from './save-prediction.js'

const token = process.env.TELEGRAM_BOT_TOKEN
if (!token) throw new Error('TELEGRAM_BOT_TOKEN is missing')
const bot = new Bot<MyContext>(token)
const games = await getData(4)

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
	ctx.reply(ctx.t('start'), { reply_markup: buildMainMenu(ctx) })
})

bot.callbackQuery('predict', async (ctx) => {
	const usersPredictions = await getPredictionsByUser(ctx.from.id, games.round)

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
	if (!!gamesWithoutPrediction.length) {
		try {
			await ctx.editMessageText(
				`${
					!!usersPredictions.length ? ctx.t('predicted', { n: games.round }) : ''
				}\n\n${usersPredictions
					.map(
						({ home_team, away_team, home_goals, away_goals }) =>
							`${home_team} – ${away_team} → ${home_goals}:${away_goals}`
					)
					.join('\n')}\n\n${ctx.t('match_select')}`,
				{
					reply_markup: buildRoundMenu(
						ctx,
						games.games,
						usersPredictions.map((p) => p.game_id)
					),
				}
			)
		} catch (err) {
			console.log(err)
			ctx.reply(JSON.stringify(err))
		}
	}
})

bot.on('callback_query:data', async (ctx) => {
	const data = ctx.callbackQuery.data
	if (data.startsWith('game_')) {
		await ctx.answerCallbackQuery()

		const game = games.games.find((game) => game.id === parseGameId(data))

		ctx.session.game = game

		if (game)
			await ctx.replyWithMediaGroup([
				{
					type: 'photo',
					media: new InputFile(logosMap[game.home.id]!),
					caption: `${ctx.t('match')} ${game?.home.team} - ${game?.away.team}?`,
				},
				{
					type: 'photo',
					media: new InputFile(logosMap[game.away.id]!),
				},
			])
	}

	if (data === 'leaderboard') {
		try {
			const leaderboard = await getLeaderboard()
			if (!leaderboard || leaderboard.length === 0) {
				await ctx.reply(ctx.t('leaderboard_empty'), {
					reply_markup: menuButtonMarkup(ctx),
				})
				return
			}

			let table = `${ctx.t('leaderboard_view')}\n\n`
			leaderboard.forEach((p, i) => {
				table += `${i + 1}. ${p.username} — ${p.points} pts\n`
			})

			await editHelper(
				() =>
					ctx.editMessageText(table, {
						reply_markup: menuButtonMarkup(ctx),
					}),
				ctx
			)
			return
		} catch (err) {
			console.error(err)
			await ctx.reply(ctx.t('leaderboard_fail'), {
				reply_markup: menuButtonMarkup(ctx),
			})
			return
		}
	}

	if (data === 'menu') {
		ctx.editMessageText(ctx.t('start'), { reply_markup: buildMainMenu(ctx) })
	}
})

bot.on('message:text', async (ctx) => {
	const msg = ctx.message.text.trim()

	if (ctx.session.game) {
		const score = sanitizeScore(msg)
		const [homeGoals, awayGoals] = score.split('-')
		const { home, away, id, round } = ctx.session.game
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
				const predicted = await getPredictionsByUser(ctx.from.id, round).then(
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

	await ctx.reply(ctx.t('fallback'))
})

bot.start()

type SessionData = { game: Game | undefined }
export type MyContext = Context & SessionFlavor<SessionData> & I18nFlavor
