import { createClient, PostgrestError } from 'jsr:@supabase/supabase-js@^2.56.0';
import { I18n, type I18nFlavor } from 'npm:@grammyjs/i18n@1.1.2';
import { supabaseAdapter } from 'npm:@grammyjs/storage-supabase@2.5.0';
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
import {
  buildEditMenu,
  buildMainMenu,
  buildMenuButton,
  buildRoundMenu,
  buildRoundsMenu,
} from '../helpers/build-menus.ts';
import {
  buildScoreMenu,
  buildScoreText,
  clampGoals,
} from '../helpers/build-score-menu.ts';
import ensurePredictionsOpen from '../helpers/ensure-predictions-open.ts';
import { displayTeamName } from '../helpers/display-team-name.ts';
import { handleLeaderboard } from '../helpers/handle-leaderboard.ts';
import { parseGameId } from '../helpers/parse-game-id.ts';
import {
  getPredictionsByRound,
  getPredictionsByUser,
  getUserRoundsWithPredictions,
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
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!token) {
	throw new Error(
		'Telegram token is missing. Set TELEGRAM_BOT_TOKEN (prod) or TELEGRAM_BOT_TOKEN_DEV (dev).',
	)
}
if (!supabaseUrl) throw new Error('db url is missing')
if (!supabaseKey) throw new Error('db key is missing')

export const bot = new Bot<MyContext>(token)
export const supabase = createClient(supabaseUrl, supabaseKey)
const adminSupabase = supabaseServiceRoleKey
	? createClient(supabaseUrl, supabaseServiceRoleKey)
	: null

const getLatestGamesSeason = async (database: typeof supabase) => {
	const { data, error } = await database
		.from('games')
		.select('season')
		.not('season', 'is', null)
		.order('game_id', { ascending: false })
		.limit(1)
		.maybeSingle()
	if (error) throw error
	return data?.season ?? undefined
}

const findOpenRound = (
	games: Array<{
		round: number
		home_goals: number | null
		away_goals: number | null
		suspended?: boolean
	}>,
) => {
	const rounds = [...new Set(games.map((game) => game.round))].sort((a, b) => a - b)
	return rounds.find((round) =>
		games.some((game) =>
			game.round === round &&
			(game.home_goals === null || game.away_goals === null) &&
			!game.suspended,
		),
	)
}

const parseGameDate = (time?: string | null, season?: string | null) => {
	if (!time) return undefined
	const normalized = time.trim().replace(/\s+/g, ' ')
	if (/^\d{1,2}:\d{2}$/.test(normalized)) return undefined
	const parsed = new Date(normalized)
	if (Number.isFinite(parsed.getTime())) return parsed

	const seasonPeriods = [...(season ?? '').matchAll(/(\d{1,2})-(\d{4})/g)]
	const yearForMonth = (month: number) => {
		const start = seasonPeriods[0]
		const end = seasonPeriods[1]
		if (!start?.[1] || !start[2]) return new Date().getFullYear()
		const startMonth = Number(start[1])
		const startYear = Number(start[2])
		if (!end?.[1] || !end[2]) return startYear
		const endYear = Number(end[2])
		return month >= startMonth ? startYear : endYear
	}
	const buildDate = (day: number, month: number, year: number, hours = 0, minutes = 0) => {
		const date = new Date(year, month - 1, day, hours, minutes)
		return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
			? date
			: undefined
	}
	const timeMatch = normalized.match(/(?:^|\s)(\d{1,2}):(\d{2})(?:\s|$)/)
	const hours = Number(timeMatch?.[1] ?? 0)
	const minutes = Number(timeMatch?.[2] ?? 0)
	const numericDate = normalized.match(/^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?\b/)
	if (numericDate?.[1] && numericDate[2]) {
		const day = Number(numericDate[1])
		const month = Number(numericDate[2])
		const explicitYear = numericDate[3] ? Number(numericDate[3]) : undefined
		const year = explicitYear
			? explicitYear < 100 ? 2000 + explicitYear : explicitYear
			: yearForMonth(month)
		return buildDate(day, month, year, hours, minutes)
	}

	const monthPrefixes: Record<string, number> = {
		янв: 1, фев: 2, мар: 3, апр: 4, май: 5, мая: 5, июн: 6,
		июл: 7, авг: 8, сен: 9, сент: 9, окт: 10, ноя: 11, дек: 12,
	}
	const russianDate = normalized.toLowerCase().match(/^(\d{1,2})\s+([а-яё]+)\.?\s*(\d{4})?/)
	if (russianDate?.[1] && russianDate[2]) {
		const day = Number(russianDate[1])
		const monthName = russianDate[2].slice(0, 4)
		const month = monthPrefixes[monthName] ?? monthPrefixes[monthName.slice(0, 3)]
		if (month) {
			const year = Number(russianDate[3] ?? yearForMonth(month))
			return buildDate(day, month, year, hours, minutes)
		}
	}
	return undefined
}

const getGamesForDisplay = async (): Promise<Game[]> => {
	const database = adminSupabase ?? supabase
	const season = await getLatestGamesSeason(database)
	if (!season) return []

	const { data, error } = await database
		.from('games')
		.select('*')
		.eq('season', season)
		.order('round', { ascending: true })
		.order('time', { ascending: true })
	if (error) throw error
	const games = data ?? []
	const currentRound = findOpenRound(games)
	if (currentRound === undefined) return []

	return games
		.filter((game) => game.round === currentRound)
		.map((game) => ({
			game_id: game.game_id,
			home_id: game.home_id,
			away_id: game.away_id,
			home_logo: game.home_logo ?? undefined,
			away_logo: game.away_logo ?? undefined,
			home: game.home_name,
			away: game.away_name,
			score: game.home_goals !== null && game.away_goals !== null
				? `${game.home_goals}:${game.away_goals}`
				: '',
			time: game.time ?? undefined,
			// The current games.time values contain only the kickoff clock time.
			date: parseGameDate(game.time, game.season) ?? new Date(Number.NaN),
			round: game.round,
			season: game.season ?? season,
			suspended: game.suspended,
		}))
}

const hasUpcomingRound = (games: Game[]) => {
	if (!games.length) return false
	const hasOpenGame = games.some((game) => !game.score && !game.suspended)
	if (!hasOpenGame) return false
	const matchDate = games.find((game) => Number.isFinite(game.date.getTime()))?.date
	if (!matchDate) return true
	const daysDiff = differenceInDays(matchDate, addHours(new Date(), 3))
	return daysDiff >= -1 && daysDiff <= 30
}

const hasMatchDayPassed = (games: Game[]) => {
	const matchDate = games.find((game) => Number.isFinite(game.date.getTime()))?.date
	return !!matchDate && matchDate <= addHours(new Date(), 3)
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

const isResultAdmin = async (telegramId: number) => {
	const { data, error } = await supabase.rpc('is_telegram_admin', {
		p_telegram_id: telegramId,
	})
	const configuredIds = Deno.env.get('TG_ADMIN_ID') ?? ''
	return (!error && data === true) || configuredIds.split(',').some((id) => Number(id.trim()) === telegramId)
}

const getResultRounds = async (selectedSeason?: string) => {
	const database = adminSupabase ?? supabase
	const season = selectedSeason ?? await getLatestGamesSeason(database)
	if (!season) return { season: '', games: [], rounds: [], currentRound: undefined }

	const query = database
		.from('games')
		.select('*')
		.eq('season', season)
		.order('round', { ascending: false })
	const { data, error } = await query
	if (error) throw error
	const games = data ?? []
	const rounds = [...new Set(games.map((game) => game.round))].sort((left, right) => right - left)
	const currentRound = findOpenRound(games) ?? rounds[0]
	return { season: season ?? games[0]?.season ?? '', games, rounds, currentRound }
}

const buildResultRoundKeyboard = (rounds: number[], currentRound?: number) => {
	const keyboard = new InlineKeyboard()
	const orderedRounds = currentRound === undefined
		? rounds
		: [currentRound, ...rounds.filter((round) => round !== currentRound)]
	orderedRounds.forEach((round) => {
		keyboard.text(round === currentRound ? `Тур ${round} (текущий)` : `Тур ${round}`, `admin_result_round_${round}`).row()
	})
	return keyboard
}

const buildResultMatchKeyboard = (games: any[], includeRoundPicker = true) => {
	const keyboard = new InlineKeyboard()
	games.forEach((game) => {
		const score = game.home_goals !== null && game.away_goals !== null
			? ` (${game.home_goals}:${game.away_goals})`
			: ''
		const suspended = game.suspended ? ' ⏸' : ''
		keyboard.text(`${game.home_name} — ${game.away_name}${score}${suspended}`, `admin_result_${game.game_id}`).row()
	})
	const hasResults = games.some((game) => game.home_goals !== null && game.away_goals !== null)
	if (hasResults && games.length) {
		keyboard.text('Сбросить все результаты тура', `admin_reset_round_${games[0].round}`).row()
	}
	if (includeRoundPicker) keyboard.text('Выбрать другой тур', 'admin_choose_result_round').row()
	return keyboard
}

const buildResetRoundConfirmationKeyboard = (round: number) =>
	new InlineKeyboard()
		.text('Подтвердить сброс', `admin_confirm_reset_round_${round}`)
		.row()
		.text('Отмена', `admin_cancel_reset_round_${round}`)

const showResultRound = async (ctx: MyContext, round: number, message: string) => {
	const { season, games } = await getResultRounds(ctx.session.resultSeason)
	ctx.session.resultSeason = season
	const roundGames = games.filter((game) => game.round === round)
	await ctx.editMessageText(message, {
		reply_markup: buildResultMatchKeyboard(roundGames, false)
			.text('К турам', 'admin_choose_result_round'),
	})
}

const handleResultCommand = async (ctx: MyContext) => {
	if (!ctx.from || !(await isResultAdmin(ctx.from.id))) {
		await ctx.reply('команда доступна только администраторам')
		return
	}

	const { season, games, currentRound } = await getResultRounds()
	if (!games.length || currentRound === undefined) {
		await ctx.reply('сейчас нет матчей для выбора')
		return
	}
	ctx.session.resultSeason = season
	const currentGames = games.filter((game) => game.round === currentRound)
	await ctx.reply(`Текущий тур — ${currentRound}. Выбери матч или другой тур:`, {
		reply_markup: buildResultMatchKeyboard(currentGames),
	})
}

bot.command(['result', 'setresult'], handleResultCommand)

const buildResultGameKeyboard = (game: {
	game_id: number
	home_goals: number | null
	away_goals: number | null
	suspended: boolean
}) => {
	const keyboard = new InlineKeyboard()
	const hasResult = game.home_goals !== null && game.away_goals !== null
	if (hasResult) {
		keyboard.text('Сбросить результат', `admin_reset_result_${game.game_id}`).row()
	}
	if (!hasResult || game.suspended) {
		keyboard
			.text(game.suspended ? 'Снять отметку «перенесён»' : 'Отметить как перенесённый', `admin_toggle_suspended_${game.game_id}`)
			.row()
	}
	keyboard.text('К турам', 'admin_choose_result_round')
	return keyboard
}

const formatResultGamePrompt = (game: {
	home_name: string
	away_name: string
	home_goals: number | null
	away_goals: number | null
	suspended: boolean
}) => {
	const score = game.home_goals !== null && game.away_goals !== null
		? `\nтекущий счёт: ${game.home_goals}:${game.away_goals}`
		: ''
	const suspended = game.suspended ? '\nматч отмечен как перенесённый' : ''
	return `матч: ${game.home_name} — ${game.away_name}${score}${suspended}\nотправь счёт, например 2-1. необязательно добавь заметку после |\nпример: 2-1 | Иванов забил, Петров получил жёлтую карточку`
}

const showPredictScreen = async (ctx: MyContext) => {
	const games = await getGamesForDisplay()
	if (!games.length || !hasUpcomingRound(games)) {
		return ctx.editMessageText(ctx.t('no_upcoming_games'), {
			reply_markup: buildMenuButton(ctx),
		})
	}

	const isPastMatchDay = hasMatchDayPassed(games)

	const usersPredictions = await getPredictionsByUser(
		ctx.from!.id,
		games[0].round,
		games[0].season,
	)

	if (isPastMatchDay && !usersPredictions.length) {
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

	const header = hasPredictions ? ctx.t('predicted', { n: roundNumber }) : `Тур ${roundNumber}`
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
	} catch (err) {
		console.log(err)
		if (err instanceof GrammyError) {
			ctx.reply(JSON.stringify(err.message))
		} else ctx.reply(JSON.stringify(err))
		ctx.reply(ctx.t('fallback'))
	}
}

const showScorePicker = async (
	ctx: MyContext,
	game: Game,
	home: number,
	away: number,
) => {
	try {
		await ctx.editMessageText(buildScoreText(ctx, game, home, away), {
			reply_markup: buildScoreMenu(ctx, game, home, away),
		})
	} catch (err) {
		// tapping an already selected value leaves the message untouched
		if (
			err instanceof GrammyError &&
			err.description.includes('message is not modified')
		) {
			return
		}
		throw err
	}
}

const openScorePicker = async (
	ctx: MyContext,
	games: Game[],
	gameId: number,
) => {
	if (!games.length || !hasUpcomingRound(games)) {
		await ctx.answerCallbackQuery()
		return ctx.editMessageText(ctx.t('no_upcoming_games'), {
			reply_markup: buildMenuButton(ctx),
		})
	}
	if (await ensurePredictionsOpen(ctx, games)) return

	const game = games.find((game: Game) => game.game_id === gameId)
	if (!game) {
		await ctx.answerCallbackQuery()
		return ctx.editMessageText(ctx.t('fallback'), {
			reply_markup: buildMenuButton(ctx),
		})
	}
	if (game.score || game.suspended) {
		await ctx.answerCallbackQuery()
		return ctx.editMessageText(ctx.t('prediction_closed'), {
			reply_markup: buildMenuButton(ctx),
		})
	}

	const prediction = (
		await getPredictionsByUser(ctx.from!.id, game.round, game.season)
	).find((p) => p.game_id === game.game_id)

	await ctx.answerCallbackQuery()
	return showScorePicker(
		ctx,
		game,
		clampGoals(prediction?.home_goals ?? 0),
		clampGoals(prediction?.away_goals ?? 0),
	)
}

bot.callbackQuery('predict', async (ctx) => {
	await ctx.answerCallbackQuery()
	await showPredictScreen(ctx)
})

bot.on('callback_query:data', async (ctx) => {
	const data = ctx.callbackQuery.data
	if (
		data.startsWith('admin_reset_round_') ||
		data.startsWith('admin_confirm_reset_round_') ||
		data.startsWith('admin_cancel_reset_round_')
	) {
		if (!ctx.from || !(await isResultAdmin(ctx.from.id))) {
			await ctx.answerCallbackQuery({ text: 'нет доступа', show_alert: true })
			return
		}

		const isConfirm = data.startsWith('admin_confirm_reset_round_')
		const isCancel = data.startsWith('admin_cancel_reset_round_')
		const prefix = isConfirm
			? 'admin_confirm_reset_round_'
			: isCancel
				? 'admin_cancel_reset_round_'
				: 'admin_reset_round_'
		const round = Number(data.slice(prefix.length))
		if (!Number.isInteger(round) || round < 1) {
			await ctx.answerCallbackQuery({ text: 'тур не найден', show_alert: true })
			return
		}

		if (isCancel) {
			await ctx.answerCallbackQuery({ text: 'сброс отменён' })
			await showResultRound(ctx, round, `Тур ${round}: выбери матч:`)
			return
		}

		if (!isConfirm) {
			await ctx.answerCallbackQuery()
			await ctx.editMessageText(
				`Сбросить все результаты тура ${round}? Счёт матчей и начисленные очки за этот тур будут сброшены.`,
				{ reply_markup: buildResetRoundConfirmationKeyboard(round) },
			)
			return
		}

		if (!adminSupabase) {
			await ctx.answerCallbackQuery({ text: 'не настроен доступ для изменения результата', show_alert: true })
			return
		}
		const { season } = await getResultRounds(ctx.session.resultSeason)
		ctx.session.resultSeason = season
		const { error } = await adminSupabase.rpc('reset_round_results', {
			p_season: season,
			p_round: round,
			p_updated_by: ctx.from.id,
		})
		if (error) {
			console.error('round result reset failed', error)
			await ctx.answerCallbackQuery({ text: 'не удалось сбросить результаты тура', show_alert: true })
			return
		}

		await ctx.answerCallbackQuery({ text: `результаты тура ${round} сброшены` })
		await showResultRound(ctx, round, `Результаты тура ${round} сброшены. Выбери матч:`)
		return
	}
	if (data.startsWith('admin_reset_result_') || data.startsWith('admin_toggle_suspended_')) {
		if (!ctx.from || !(await isResultAdmin(ctx.from.id))) {
			await ctx.answerCallbackQuery({ text: 'нет доступа', show_alert: true })
			return
		}
		if (!adminSupabase) {
			await ctx.answerCallbackQuery({ text: 'не настроен доступ для изменения результата', show_alert: true })
			return
		}
		const isReset = data.startsWith('admin_reset_result_')
		const prefix = isReset ? 'admin_reset_result_' : 'admin_toggle_suspended_'
		const gameId = Number(data.slice(prefix.length))
		const { data: game, error: gameError } = await adminSupabase
			.from('games')
			.select('*')
			.eq('game_id', gameId)
			.maybeSingle()
		if (gameError || !game) {
			await ctx.answerCallbackQuery({ text: 'матч не найден', show_alert: true })
			return
		}

		if (isReset) {
			const { error } = await adminSupabase.rpc('reset_game_result', {
				p_game_id: gameId,
				p_updated_by: ctx.from.id,
			})
			if (error) {
				console.error('result reset failed', error)
				await ctx.answerCallbackQuery({ text: 'не удалось сбросить результат', show_alert: true })
				return
			}
		} else {
			const { error } = await adminSupabase
				.from('games')
				.update({ suspended: !game.suspended })
				.eq('game_id', gameId)
			if (error) {
				console.error('suspended state update failed', error)
				await ctx.answerCallbackQuery({ text: 'не удалось изменить статус матча', show_alert: true })
				return
			}
		}

		const { data: updatedGame, error: updatedGameError } = await adminSupabase
			.from('games')
			.select('*')
			.eq('game_id', gameId)
			.maybeSingle()
		if (updatedGameError || !updatedGame) {
			await ctx.answerCallbackQuery()
			return
		}
		ctx.session.pendingResultGameId = gameId
		await ctx.answerCallbackQuery({
			text: isReset ? 'результат сброшен' : updatedGame.suspended ? 'матч отмечен как перенесённый' : 'отметка снята',
		})
		await ctx.editMessageText(formatResultGamePrompt(updatedGame), {
			reply_markup: buildResultGameKeyboard(updatedGame),
		})
		return
	}
	if (data === 'admin_choose_result_round' || data.startsWith('admin_result_round_')) {
		if (!ctx.from || !(await isResultAdmin(ctx.from.id))) {
			await ctx.answerCallbackQuery({ text: 'нет доступа', show_alert: true })
			return
		}
		const { season, games, rounds, currentRound } = await getResultRounds()
		ctx.session.resultSeason = season
		if (data === 'admin_choose_result_round') {
			await ctx.answerCallbackQuery()
			await ctx.editMessageText('выбери тур:', { reply_markup: buildResultRoundKeyboard(rounds, currentRound) })
			return
		}
		const round = Number(data.slice('admin_result_round_'.length))
		const roundGames = games.filter((game) => game.round === round)
		await ctx.answerCallbackQuery()
		await ctx.editMessageText(`Тур ${round}: выбери матч:`, {
			reply_markup: buildResultMatchKeyboard(roundGames, false).text('К турам', 'admin_choose_result_round'),
		})
		return
	}
	if (data.startsWith('admin_result_')) {
		if (!ctx.from || !(await isResultAdmin(ctx.from.id))) {
			await ctx.answerCallbackQuery({ text: 'нет доступа', show_alert: true })
			return
		}
		const gameId = Number(data.slice('admin_result_'.length))
		const database = adminSupabase ?? supabase
		const { data: game, error } = await database.from('games').select('*').eq('game_id', gameId).maybeSingle()
		if (error || !game) {
			await ctx.answerCallbackQuery({ text: 'матч не найден', show_alert: true })
			return
		}
		ctx.session.pendingResultGameId = gameId
		await ctx.answerCallbackQuery()
		await ctx.editMessageText(formatResultGamePrompt(game), {
			reply_markup: buildResultGameKeyboard(game),
		})
		return
	}
	const games = await getGamesForDisplay()
	const currentSeason = games[0]?.season

	if (data.startsWith('game_')) {
		return await openScorePicker(ctx, games, parseGameId(data))
	}

	if (data.startsWith('sc_') || data.startsWith('scs_')) {
		const isSubmit = data.startsWith('scs_')
		const [, gameIdRaw, homeRaw, awayRaw] = data.split('_')
		const gameId = Number(gameIdRaw)
		const homeGoals = clampGoals(Number(homeRaw))
		const awayGoals = clampGoals(Number(awayRaw))
		const game = games.find((game: Game) => game.game_id === gameId)

		if (!game || game.score || game.suspended || !hasUpcomingRound(games)) {
			await ctx.answerCallbackQuery()
			return ctx.editMessageText(ctx.t('no_upcoming_games'), {
				reply_markup: buildMenuButton(ctx),
			})
		}
		if (await ensurePredictionsOpen(ctx, games)) return

		if (!isSubmit) {
			await ctx.answerCallbackQuery()
			return await showScorePicker(ctx, game, homeGoals, awayGoals)
		}

		try {
			await saveUserPrediction(
				gameId,
				ctx,
				game.home,
				game.away,
				`${homeGoals}-${awayGoals}`,
				game.round,
				game.season,
			)
		} catch (err) {
			console.error(err)
			const errMessage = err as PostgrestError
			await ctx.answerCallbackQuery()
			return await ctx.reply(
				ctx.t('prediction_fail', { err: errMessage.message }),
				{ parse_mode: 'HTML' },
			)
		}

		await ctx.answerCallbackQuery({
			text: `${ctx.t('score_saved')} ${game.home} – ${game.away} → ${homeGoals}:${awayGoals}`,
		})
		return await showPredictScreen(ctx)
	}

	if (data.startsWith('leaderboard'))
		return await handleLeaderboard(ctx, data, currentSeason)
	if (data.endsWith('noop')) {
		return ctx.answerCallbackQuery()
	}

	if (data === 'menu') {
		ctx.session = { leaderboard: { page: 1, total_pages: 1 } }
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

			return `${displayTeamName(game.home)} – ${displayTeamName(game.away)}\n${formatOutcomePercentages(
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
		return await openScorePicker(ctx, games, parseGameId(data))
	}
})

bot.on('message:text', async (ctx) => {
	const pendingGameId = ctx.session.pendingResultGameId
	if (pendingGameId) {
		if (!ctx.from || !(await isResultAdmin(ctx.from.id))) {
			delete ctx.session.pendingResultGameId
			await ctx.reply('команда доступна только администраторам')
			return
		}
		const [scoreText, ...noteParts] = ctx.msg.text.split('|')
		const score = scoreText?.trim().match(/^(\d+)\s*[-:]\s*(\d+)$/)
		if (!score) {
			await ctx.reply('не распознал счёт. отправь его в формате 2-1; заметку можно добавить после |')
			return
		}
		const database = adminSupabase ?? supabase
		const { data: game, error: gameError } = await database.from('games').select('*').eq('game_id', pendingGameId).maybeSingle()
		if (gameError || !game) {
			delete ctx.session.pendingResultGameId
			await ctx.reply('матч не найден, начни заново командой /setresult')
			return
		}
		const homeGoals = Number(score[1])
		const awayGoals = Number(score[2])
		const note = noteParts.join('|').trim() || null
		if (!adminSupabase) {
			await ctx.reply('не настроен доступ для сохранения результата')
			return
		}
		const { error } = await adminSupabase.from('match_results').upsert({
			game_id: game.game_id,
			season: game.season ?? '',
			round: game.round,
			time: game.time,
			home_id: game.home_id,
			home_name: game.home_name,
			home_logo: game.home_logo,
			away_id: game.away_id,
			away_name: game.away_name,
			away_logo: game.away_logo,
			home_goals: homeGoals,
			away_goals: awayGoals,
			note,
			updated_by: ctx.from.id,
		}, { onConflict: 'game_id' })
		if (error) {
			console.error('result submission failed', error)
			await ctx.reply('не удалось сохранить результат')
			return
		}
		const { error: gameUpdateError } = await adminSupabase.from('games').update({ home_goals: homeGoals, away_goals: awayGoals, suspended: false }).eq('game_id', pendingGameId)
		if (gameUpdateError) console.error('failed to sync game score', gameUpdateError)
		delete ctx.session.pendingResultGameId
		await ctx.reply(`сохранено: ${game.home_name} ${homeGoals}:${awayGoals} ${game.away_name}${note ? `\n${note}` : ''}`)
		return
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
	pendingResultGameId?: number
	resultSeason?: string
	leaderboard: {
		page: number
		total_pages: number
		season?: string | null
	}
}
export type MyContext = Context & SessionFlavor<SessionData> & I18nFlavor
