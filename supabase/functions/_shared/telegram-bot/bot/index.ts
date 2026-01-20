import { createClient, PostgrestError } from 'jsr:@supabase/supabase-js@^2.56.0';
import { I18n, type I18nFlavor } from 'npm:@grammyjs/i18n@1.1.2';
import { supabaseAdapter } from 'npm:@grammyjs/storage-supabase@2.5.0';
import { addDays } from 'npm:date-fns@4.1.0/addDays';
import { addHours } from 'npm:date-fns@4.1.0/addHours';
import { differenceInDays } from 'npm:date-fns@4.1.0/differenceInDays';
import {
  Bot,
  Context,
  GrammyError,
  InlineKeyboard,
  session,
  SessionFlavor,
} from 'npm:grammy@^1.38.3';
import { buildMatchMessage } from '../helpers/build-match-message.ts';
import {
  buildEditMenu,
  buildMainMenu,
  buildMenuButton,
  buildRoundMenu,
} from '../helpers/build-menus.ts';
import ensurePredictionsOpen from '../helpers/ensure-predictions-open.ts';
import { handleLeaderboard } from '../helpers/handle-leaderboard.ts';
import { parseGameId } from '../helpers/parse-game-id.ts';
import { parseScore } from '../helpers/parse-score.ts';
import {
  getCurrentRound,
  getNextRound,
  getPredictionsByUser
} from '../lib/supabase-client.ts';
import { Game } from '../lib/types.ts';
import ru from '../locales/ru.ts';
import { formatUserPredictions } from './format-user-predictions.ts';
import { gameResultIteratee } from './game-result-iteratee.ts';
import { groupPredictionsByStatus } from './group-predictions-by-status.ts';
import { saveUserPrediction } from './save-prediction.ts';

// const token = Deno.env.get('TELEGRAM_BOT_TOKEN_DEV')
const token = Deno.env.get('TELEGRAM_BOT_TOKEN')
const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')

if (!token) throw new Error('TELEGRAM_BOT_TOKEN is missing')
if (!supabaseUrl) throw new Error('db url is missing')
if (!supabaseKey) throw new Error('db key is missing')

export const bot = new Bot<MyContext>(token)
export const supabase = createClient(supabaseUrl, supabaseKey)

const currentGames = await getCurrentRound()
const nextGames = await getNextRound()

const games =
	currentGames.some((game) => !game.score) &&
	addDays(new Date(currentGames.at(-1)!.date), 1) >= new Date()
		? currentGames
		: nextGames

const i18n = new I18n<Context>({
	defaultLocale: 'ru',
})

await i18n.loadLocale('ru', { source: ru })

const roundMenu = new InlineKeyboard()

bot
	.use(i18n)
	.use(
		session({
			initial: (): SessionData => ({
				game: undefined,
				leaderboard: { page: 1, total_pages: 1 },
			}),
			storage: supabaseAdapter<SessionData>({
				// deno-lint-ignore no-explicit-any
				supabase: supabase as any,
				table: 'memory',
			}),
		}),
	)
	// NB DEV
	// .use(async (ctx, next) => {
	// 	if (ctx.from) await updateId(ctx.from)
	// 	return next()
	// })

bot.command('start', async (ctx) => {
	ctx.session = {
		game: undefined,
		leaderboard: { page: 1, total_pages: 1 },
	}
	ctx.reply(ctx.t('start'), { reply_markup: await buildMainMenu(ctx, games) })
})

bot.command('changelog', async (ctx) => {
	if (!ctx.from) return

	const adminId = Deno.env.get('TG_ADMIN_ID')

	if (adminId && ctx.from.id === parseInt(adminId)) {
		const { data, error } = await supabase.functions.invoke('changelog', {
			body: {
				name: 'Functions',
				message: ctx.match,
				disable_notification: true,
			},
		})
		if (error) {
			console.error('Error invoking function:', error)
		} else {
			console.log('Function result:', data)
		}
	}
})

bot.callbackQuery('predict', async (ctx) => {
	const matchDate = new Date(games[0].date)
	const now = addHours(new Date(), 3)
	const isPastMatchDay = matchDate <= now

	if (!games || differenceInDays(matchDate, now) > 30) {
		await ctx.answerCallbackQuery()
		return ctx.editMessageText(ctx.t('no_upcoming_games'), {
			reply_markup: buildMenuButton(ctx),
		})
	}

	const usersPredictions = await getPredictionsByUser(
		ctx.from.id,
		games[0].round,
	)

	if (isPastMatchDay && !usersPredictions.length) {
		await ctx.answerCallbackQuery()
		return ctx.editMessageText(
			ctx.t('no_predictions_made') +
				'\n\n' +
				games.map(gameResultIteratee).join('\n'),
			{
				reply_markup: buildMenuButton(ctx),
			},
		)
	}

	const gamesWithPrediction: Game[] = []
	const gamesWithoutPrediction: Game[] = []

	games.forEach((game: Game) => {
		const hasPrediction = usersPredictions.some(
			(p) => p.game_id === game.game_id,
		)
		if (hasPrediction) {
			gamesWithPrediction.push(game)
		} else {
			gamesWithoutPrediction.push(game)
		}
	})

	gamesWithoutPrediction.forEach(({ game_id, home, away }) => {
		roundMenu.text(`${home} — ${away}`, `game_${game_id}`)
		roundMenu.row()
	})

	roundMenu.text(ctx.t('menu'), 'menu')

	const hasPredictions = usersPredictions.length > 0
	const roundNumber = games[0].round
	const groupedPredictions = groupPredictionsByStatus(usersPredictions)
	const predictionsList = formatUserPredictions(groupedPredictions, ctx)

	const header = hasPredictions ? ctx.t('predicted', { n: roundNumber }) : ''
	const body = predictionsList
	const footer = isPastMatchDay
		? ctx.t('prediction_closed')
		: gamesWithoutPrediction.length
			? ctx.t('match_select')
			: ''

	const text = `${header}\n\n${body}\n\n${footer}`

	const replyMarkup = !isPastMatchDay
		? buildRoundMenu(
				ctx,
				games,
				usersPredictions.map((p) => p.game_id),
			)
		: buildMenuButton(ctx)

	try {
		await ctx.editMessageText(text, { reply_markup: replyMarkup })
		await ctx.answerCallbackQuery()
	} catch (err) {
		console.log(err)
		if (err instanceof GrammyError) {
			ctx.reply(JSON.stringify(err.message))
		} else ctx.reply(JSON.stringify(err))
		ctx.reply(ctx.t('fallback'))
	}
})

bot.on('callback_query:data', async (ctx) => {
	const data = ctx.callbackQuery.data

	if (data.startsWith('game_')) {
		await ctx.answerCallbackQuery()

		const game = games.find((game: Game) => game.game_id === parseGameId(data))

		ctx.session.game = game

		if (game) await buildMatchMessage(ctx, game)
	}

	if (data.startsWith('leaderboard')) await handleLeaderboard(ctx, data)

	if (data === 'menu') {
		ctx.session = { game: undefined, leaderboard: { page: 1, total_pages: 1 } }
		ctx.answerCallbackQuery()
		ctx.editMessageText(ctx.t('start'), {
			reply_markup: await buildMainMenu(ctx, games),
		})
	}

	if (data === 'prev') {
		const usersPredictions = await getPredictionsByUser(
			ctx.from!.id,
			games[0].round - 1,
		)
		const grouped = groupPredictionsByStatus(usersPredictions)
		const predictionsList = formatUserPredictions(grouped, ctx)

		ctx.editMessageText(predictionsList, { reply_markup: buildMenuButton(ctx) })
		ctx.answerCallbackQuery()
	}

	if (data === 'edit') {
		if (await ensurePredictionsOpen(ctx, games)) return
		const usersPredictions = await getPredictionsByUser(
			ctx.from!.id,
			games[0].round,
		)
		ctx.editMessageText(ctx.t('choose_edit_match'), {
			reply_markup: buildEditMenu(ctx, usersPredictions),
		})
		ctx.answerCallbackQuery()
	}

	if (data.startsWith('edit_')) {
		if (await ensurePredictionsOpen(ctx, games)) return
		const game = games.find((game: Game) => game.game_id === parseGameId(data))

		ctx.session.game = game

		await ctx.answerCallbackQuery()
		if (game) await buildMatchMessage(ctx, game)
	}
})

bot.on('message:text', async (ctx) => {
	const msg = ctx.message.text.trim()

	if (ctx.session.game) {
		const score = parseScore(msg)
		const [homeGoals, awayGoals] = score.split('-')
		const { home, away, round, game_id } = ctx.session.game
		try {
			return await saveUserPrediction(
				game_id,
				ctx,
				home,
				away,
				score,
				round,
			).then(async () => {
				await ctx.reply(
					ctx.t('prediction_made', {
						n: '\n\n',
						home,
						away,
						homeGoals,
						awayGoals,
					}),
					{ parse_mode: 'MarkdownV2' },
				)
				const predicted = await getPredictionsByUser(ctx.from.id, round).then(
					(data) => data.map((p) => p.game_id),
				)
				const title =
					predicted.length < games.length
						? ctx.t('match_select')
						: ctx.t('all_predictions_made')

				await ctx.reply(title, {
					reply_markup: buildRoundMenu(ctx, games, predicted),
				})
				ctx.session.game = undefined
			})
		} catch (err) {
			console.error(err)
			const errMessage = err as PostgrestError
			return await ctx.reply(
				ctx.t('prediction_fail', {
					err: errMessage.message,
				}),
				{
					parse_mode: 'HTML',
				},
			)
		}
	}

	await ctx.reply(ctx.t('fallback'))
})

// bot.start()

export type SessionData = {
	game: Game | undefined
	leaderboard: {
		page: number
		total_pages: number
	}
}
export type MyContext = Context & SessionFlavor<SessionData> & I18nFlavor
