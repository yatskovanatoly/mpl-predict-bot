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
  session,
  SessionFlavor,
} from 'npm:grammy@^1.38.3';
import { buildMatchMessage } from '../helpers/build-match-message.ts';
import {
  buildEditMenu,
  buildMainMenu,
  buildMenuButton,
  buildRoundMenu,
  buildRoundsMenu,
  buildUsersMenu,
} from '../helpers/build-menus.ts';
import ensurePredictionsOpen from '../helpers/ensure-predictions-open.ts';
import { handleLeaderboard } from '../helpers/handle-leaderboard.ts';
import { parseGameId } from '../helpers/parse-game-id.ts';
import { parseScore } from '../helpers/parse-score.ts';
import { sanitizeTeamName } from '../helpers/sanitize-team-name.ts';
import {
  getAllRoundsFromGames,
  getCurrentRound,
  getNextRound,
  getPredictionsByRound,
  getPredictionsByUser,
  getUserRoundsWithPredictions,
  getUsersWithPredictionsByRound,
  updateId
} from '../lib/supabase-client.ts';
import { Game } from '../lib/types.ts';
import ru from '../locales/ru.ts';
import { formatUserPredictions } from './format-user-predictions.ts';
import { gameResultIteratee } from './game-result-iteratee.ts';
import { groupPredictionsByStatus } from './group-predictions-by-status.ts';
import { saveUserPrediction } from './save-prediction.ts';

type AppEnv = 'development' | 'production'
type BotMode = 'polling' | 'webhook'
const ROUNDS_PAGE_SIZE = 10
const OTHERS_USERS_PAGE_SIZE = 10

const appEnv = (
	Deno.env.get('APP_ENV') ??
	Deno.env.get('ENV') ??
	'production'
).toLowerCase() as AppEnv
const isDev = appEnv === 'development'
const botMode = (Deno.env.get('BOT_MODE') ??
	(isDev ? 'polling' : 'webhook')) as BotMode
const token = isDev
	? Deno.env.get('TELEGRAM_BOT_TOKEN_DEV') ?? Deno.env.get('TELEGRAM_BOT_TOKEN')
	: Deno.env.get('TELEGRAM_BOT_TOKEN') ?? Deno.env.get('TELEGRAM_BOT_TOKEN_DEV')
const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')

if (!token) {
	throw new Error(
		'Telegram token is missing. Set TELEGRAM_BOT_TOKEN (prod) or TELEGRAM_BOT_TOKEN_DEV (dev).',
	)
}
if (!supabaseUrl) throw new Error('db url is missing')
if (!supabaseKey) throw new Error('db key is missing')

export const bot = new Bot<MyContext>(token)
export const supabase = createClient(supabaseUrl, supabaseKey)

const getGamesForDisplay = async (): Promise<Game[]> => {
	const currentGames = await getCurrentRound()
	const nextGames = await getNextRound()

	if (!currentGames.length) return nextGames
	if (!nextGames.length) return currentGames

	const currentLastDateRaw = currentGames.at(-1)?.date
	const currentLastDate = currentLastDateRaw
		? new Date(currentLastDateRaw)
		: undefined
	const currentIsActive =
		currentGames.some((game) => !game.score) &&
		!!currentLastDate &&
		!Number.isNaN(currentLastDate.getTime()) &&
		addDays(currentLastDate, 1) >= new Date()

	return currentIsActive ? currentGames : nextGames
}

const hasUpcomingRound = (games: Game[]) => {
	if (!games.length) return false
	const matchDate = new Date(games[0].date)
	if (Number.isNaN(matchDate.getTime())) return false
	const daysDiff = differenceInDays(matchDate, addHours(new Date(), 3))
	return daysDiff >= -1 && daysDiff <= 30
}

const formatDisplayName = ({
	username,
	first_name,
	last_name,
	user_id,
}: {
	username: string | null
	first_name: string | null
	last_name: string | null
	user_id: number
}) => {
	if (username) return `@${username}`
	const name = `${first_name ?? ''} ${last_name ?? ''}`.trim()
	return name || `${user_id}`
}

const formatOutcomePercentages = (
	homeWinCount: number,
	drawCount: number,
	awayWinCount: number,
) => {
	const total = homeWinCount + drawCount + awayWinCount
	if (!total) {
		return 'П1 0% • X 0% • П2 0% (0)'
	}
	const homePct = Math.round((homeWinCount / total) * 100)
	const drawPct = Math.round((drawCount / total) * 100)
	const awayPct = Math.max(0, 100 - homePct - drawPct)
	return `П1 ${homePct}% • X ${drawPct}% • П2 ${awayPct}% (${total})`
}

const i18n = new I18n<Context>({
	defaultLocale: 'ru',
})

await i18n.loadLocale('ru', { source: ru })

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
	.use(async (ctx, next) => {
		if (ctx.from) await updateId(ctx.from)
		return next()
	})

bot.command('start', async (ctx) => {
	const games = await getGamesForDisplay()
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
	const games = await getGamesForDisplay()
	if (!games.length || !hasUpcomingRound(games)) {
		await ctx.answerCallbackQuery()
		return ctx.editMessageText(ctx.t('no_upcoming_games'), {
			reply_markup: buildMenuButton(ctx),
		})
	}

	const matchDate = new Date(games[0].date)
	const now = addHours(new Date(), 3)
	const isPastMatchDay = matchDate <= now

	const usersPredictions = await getPredictionsByUser(
		ctx.from.id,
		games[0].round,
		games[0].season,
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

	const gamesWithoutPrediction: Game[] = []

	games.forEach((game: Game) => {
		const hasPrediction = usersPredictions.some(
			(p) => p.game_id === game.game_id,
		)
		if (!hasPrediction) {
			gamesWithoutPrediction.push(game)
		}
	})

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
	const games = await getGamesForDisplay()
	const currentSeason = games[0]?.season

	if (data.startsWith('game_')) {
		await ctx.answerCallbackQuery()
		if (!games.length || !hasUpcomingRound(games)) {
			return ctx.editMessageText(ctx.t('no_upcoming_games'), {
				reply_markup: buildMenuButton(ctx),
			})
		}

		const game = games.find((game: Game) => game.game_id === parseGameId(data))

		ctx.session.game = game

		if (game) await buildMatchMessage(ctx, game)
	}

	if (data.startsWith('leaderboard')) await handleLeaderboard(ctx, data)
	if (data.endsWith('noop')) {
		return ctx.answerCallbackQuery()
	}

	if (data === 'menu') {
		ctx.session = { game: undefined, leaderboard: { page: 1, total_pages: 1 } }
		ctx.answerCallbackQuery()
		ctx.editMessageText(ctx.t('start'), {
			reply_markup: await buildMainMenu(ctx, games),
		})
	}

	if (data === 'prev') {
		if (!games.length || games[0].round <= 1) {
			await ctx.answerCallbackQuery()
			return ctx.editMessageText(ctx.t('no_upcoming_games'), {
				reply_markup: buildMenuButton(ctx),
			})
		}

		const usersPredictions = await getPredictionsByUser(
			ctx.from!.id,
			games[0].round - 1,
			games[0].season,
		)
		const grouped = groupPredictionsByStatus(usersPredictions)
		const predictionsList = formatUserPredictions(grouped, ctx)

		ctx.editMessageText(predictionsList, { reply_markup: buildMenuButton(ctx) })
		ctx.answerCallbackQuery()
	}

	if (data === 'my_rounds') {
		const rounds = await getUserRoundsWithPredictions(ctx.from!.id, currentSeason)
		await ctx.answerCallbackQuery()
		if (!rounds.length) {
			return ctx.editMessageText(ctx.t('no_rounds_with_predictions'), {
				reply_markup: buildMenuButton(ctx),
			})
		}
		return ctx.editMessageText(ctx.t('choose_round'), {
			reply_markup: buildRoundsMenu(
				ctx,
				rounds,
				'mr_',
				1,
				ROUNDS_PAGE_SIZE,
			),
		})
	}

	if (data.startsWith('mr_page_')) {
		const page = Number(data.replace('mr_page_', ''))
		const rounds = await getUserRoundsWithPredictions(ctx.from!.id, currentSeason)
		await ctx.answerCallbackQuery()
		if (!rounds.length) {
			return ctx.editMessageText(ctx.t('no_rounds_with_predictions'), {
				reply_markup: buildMenuButton(ctx),
			})
		}
		return ctx.editMessageText(ctx.t('choose_round'), {
			reply_markup: buildRoundsMenu(
				ctx,
				rounds,
				'mr_',
				Number.isFinite(page) ? page : 1,
				ROUNDS_PAGE_SIZE,
			),
		})
	}

	if (data.startsWith('mr_')) {
		const round = Number(data.replace('mr_', ''))
		if (!Number.isFinite(round) || round <= 0) {
			await ctx.answerCallbackQuery()
			return ctx.editMessageText(ctx.t('fallback'), {
				reply_markup: buildMenuButton(ctx),
			})
		}
		const usersPredictions = await getPredictionsByUser(
			ctx.from!.id,
			round,
			currentSeason,
		)
		await ctx.answerCallbackQuery()
		if (!usersPredictions.length) {
			return ctx.editMessageText(ctx.t('no_predictions_for_round'), {
				reply_markup: buildMenuButton(ctx),
			})
		}
		const grouped = groupPredictionsByStatus(usersPredictions)
		const predictionsList = formatUserPredictions(grouped, ctx)
		const title = ctx.t('round_predictions', { n: round })
		return ctx.editMessageText(`${title}\n\n${predictionsList}`, {
			reply_markup: buildMenuButton(ctx),
		})
	}

	if (data === 'others_rounds') {
		const rounds = await getAllRoundsFromGames()
		await ctx.answerCallbackQuery()
		if (!rounds.length) {
			return ctx.editMessageText(ctx.t('no_rounds_with_predictions'), {
				reply_markup: buildMenuButton(ctx),
			})
		}
		return ctx.editMessageText(ctx.t('choose_round'), {
			reply_markup: buildRoundsMenu(
				ctx,
				rounds,
				'or_',
				1,
				ROUNDS_PAGE_SIZE,
			),
		})
	}

	if (data === 'upcoming_percentages') {
		const games = await getGamesForDisplay()
		await ctx.answerCallbackQuery()
		if (!games.length || !hasUpcomingRound(games)) {
			return ctx.editMessageText(ctx.t('no_upcoming_games'), {
				reply_markup: buildMenuButton(ctx),
			})
		}

		const round = games[0].round
		const predictions = await getPredictionsByRound(round, currentSeason)
		if (!predictions.length) {
			return ctx.editMessageText(ctx.t('no_upcoming_predictions'), {
				reply_markup: buildMenuButton(ctx),
			})
		}

		const lines = games.map((game) => {
			let homeWinCount = 0
			let drawCount = 0
			let awayWinCount = 0

			predictions.forEach((prediction) => {
				if (prediction.game_id !== game.game_id) return
				if (prediction.home_goals > prediction.away_goals) {
					homeWinCount += 1
				} else if (prediction.home_goals < prediction.away_goals) {
					awayWinCount += 1
				} else {
					drawCount += 1
				}
			})

			return `${sanitizeTeamName(game.home)} – ${sanitizeTeamName(game.away)}\n${formatOutcomePercentages(
				homeWinCount,
				drawCount,
				awayWinCount,
			)}`
		})

		const title = ctx.t('upcoming_percentages_title', { n: round })
		const legend = ctx.t('percentages_legend')
		return ctx.editMessageText(`${title}\n\n${lines.join('\n\n')}\n\n${legend}`, {
			reply_markup: buildMenuButton(ctx),
		})
	}

	if (data.startsWith('or_page_')) {
		const page = Number(data.replace('or_page_', ''))
		const rounds = await getAllRoundsFromGames()
		await ctx.answerCallbackQuery()
		if (!rounds.length) {
			return ctx.editMessageText(ctx.t('no_rounds_with_predictions'), {
				reply_markup: buildMenuButton(ctx),
			})
		}
		return ctx.editMessageText(ctx.t('choose_round'), {
			reply_markup: buildRoundsMenu(
				ctx,
				rounds,
				'or_',
				Number.isFinite(page) ? page : 1,
				ROUNDS_PAGE_SIZE,
			),
		})
	}

	if (data.startsWith('or_')) {
		const round = Number(data.replace('or_', ''))
		if (!Number.isFinite(round) || round <= 0) {
			await ctx.answerCallbackQuery()
			return ctx.editMessageText(ctx.t('fallback'), {
				reply_markup: buildMenuButton(ctx),
			})
		}
		const users = await getUsersWithPredictionsByRound(
			round,
			ctx.from?.id,
			currentSeason,
		)
		await ctx.answerCallbackQuery()
		if (!users.length) {
			return ctx.editMessageText(ctx.t('no_users_for_round'), {
				reply_markup: buildMenuButton(ctx),
			})
		}
		return ctx.editMessageText(ctx.t('choose_user'), {
			reply_markup: buildUsersMenu(
				ctx,
				users,
				round,
				1,
				OTHERS_USERS_PAGE_SIZE,
			),
		})
	}

	if (data.startsWith('ou_page_')) {
		const [, , roundRaw, pageRaw] = data.split('_')
		const round = Number(roundRaw)
		const page = Number(pageRaw)
		if (!Number.isFinite(round) || round <= 0) {
			await ctx.answerCallbackQuery()
			return ctx.editMessageText(ctx.t('fallback'), {
				reply_markup: buildMenuButton(ctx),
			})
		}
		const users = await getUsersWithPredictionsByRound(
			round,
			ctx.from?.id,
			currentSeason,
		)
		await ctx.answerCallbackQuery()
		if (!users.length) {
			return ctx.editMessageText(ctx.t('no_users_for_round'), {
				reply_markup: buildMenuButton(ctx),
			})
		}
		return ctx.editMessageText(ctx.t('choose_user'), {
			reply_markup: buildUsersMenu(
				ctx,
				users,
				round,
				Number.isFinite(page) ? page : 1,
				OTHERS_USERS_PAGE_SIZE,
			),
		})
	}

	if (data.startsWith('ou_')) {
		const [, roundRaw, userRaw] = data.split('_')
		const round = Number(roundRaw)
		const userId = Number(userRaw)
		if (!Number.isFinite(round) || !Number.isFinite(userId) || round <= 0) {
			await ctx.answerCallbackQuery()
			return ctx.editMessageText(ctx.t('fallback'), {
				reply_markup: buildMenuButton(ctx),
			})
		}
		const usersPredictions = await getPredictionsByUser(
			userId,
			round,
			currentSeason,
		)
		await ctx.answerCallbackQuery()
		if (!usersPredictions.length) {
			return ctx.editMessageText(ctx.t('no_predictions_for_round'), {
				reply_markup: buildMenuButton(ctx),
			})
		}
		const grouped = groupPredictionsByStatus(usersPredictions)
		const predictionsList = formatUserPredictions(grouped, ctx)
		const firstPrediction = usersPredictions[0]
		const name = formatDisplayName({
			username: firstPrediction.username ?? null,
			first_name: firstPrediction.first_name ?? null,
			last_name: firstPrediction.last_name ?? null,
			user_id: userId,
		})
		const title = ctx.t('user_round_predictions', { name, n: round })
		return ctx.editMessageText(`${title}\n\n${predictionsList}`, {
			reply_markup: buildMenuButton(ctx),
		})
	}

	if (data === 'edit') {
		if (!games.length || !hasUpcomingRound(games)) {
			await ctx.answerCallbackQuery()
			return ctx.editMessageText(ctx.t('no_upcoming_games'), {
				reply_markup: buildMenuButton(ctx),
			})
		}
		if (await ensurePredictionsOpen(ctx, games)) return
		const usersPredictions = await getPredictionsByUser(
			ctx.from!.id,
			games[0].round,
			games[0].season,
		)
		ctx.editMessageText(ctx.t('choose_edit_match'), {
			reply_markup: buildEditMenu(ctx, usersPredictions),
		})
		ctx.answerCallbackQuery()
	}

	if (data.startsWith('edit_')) {
		if (!games.length || !hasUpcomingRound(games)) {
			await ctx.answerCallbackQuery()
			return ctx.editMessageText(ctx.t('no_upcoming_games'), {
				reply_markup: buildMenuButton(ctx),
			})
		}
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
		const { home, away, round, game_id, season } = ctx.session.game
		try {
			return await saveUserPrediction(
				game_id,
				ctx,
				home,
				away,
				score,
				round,
				season,
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
				const predicted = await getPredictionsByUser(
					ctx.from.id,
					round,
					season,
				).then((data) => data.map((p) => p.game_id))
				const games = await getGamesForDisplay()
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

if (import.meta.main) {
	if (botMode === 'polling') {
		console.log(`[bot] Starting in polling mode (${appEnv})`)
		await bot.start({
			drop_pending_updates: true,
			onStart: () => console.log('[bot] Polling started'),
		})
	} else {
		console.log(
			`[bot] Mode "${botMode}" (${appEnv}). Webhook serving is handled by supabase/functions/telegram-bot/index.ts`,
		)
	}
}

export type SessionData = {
	game: Game | undefined
	leaderboard: {
		page: number
		total_pages: number
	}
}
export type MyContext = Context & SessionFlavor<SessionData> & I18nFlavor
