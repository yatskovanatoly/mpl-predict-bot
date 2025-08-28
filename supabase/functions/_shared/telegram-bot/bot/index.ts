import {
  Bot,
  Context,
  InlineKeyboard,
  session,
  SessionFlavor,
} from 'https://deno.land/x/grammy@v1.38.1/mod.ts'
import { differenceInDays } from 'jsr:@mary/date-fns'
import { PostgrestError } from 'jsr:@supabase/supabase-js'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { I18n, type I18nFlavor } from 'npm:@grammyjs/i18n'
import { supabaseAdapter } from 'npm:@grammyjs/storage-supabase'
import {
  buildMainMenu,
  buildMenuButton,
  buildRoundMenu,
} from '../helpers/build-menus.ts'
import { editHelper } from '../helpers/edit-helper.ts'
import { parseGameId } from '../helpers/parse-game-id.ts'
import { sanitizeScore } from '../helpers/parse-score.ts'
import { logosMap } from '../lib/logos-by-id.ts'
import {
  getCurrentRound,
  getLeaderboard,
  getPredictionsByUser,
} from '../lib/supabase-client.ts'
import { Game } from '../lib/types.ts'
import { FALLBACK_IMG } from '../lib/urls.ts'
import ru from '../locales/ru.ts'
import { saveUserPrediction } from './save-prediction.ts'
import { userPredictionIteratee } from './user-prediction-iteratee.ts'

const token = Deno.env.get('TELEGRAM_BOT_TOKEN_DEV')
const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')

if (!token) throw new Error('TELEGRAM_BOT_TOKEN is missing')
if (!supabaseUrl) throw new Error('db url is missing')
if (!supabaseKey) throw new Error('db key is missing')

export const bot = new Bot<MyContext>(token)
export const supabase = createClient(supabaseUrl, supabaseKey)

const games = await getCurrentRound()

const i18n = new I18n<any>({
	defaultLocale: 'ru',
})

await i18n.loadLocale('ru', { source: ru })

const roundMenu = new InlineKeyboard()

bot.use(i18n).use(
	session({
		initial: (): SessionData => ({ game: undefined }),
		storage: supabaseAdapter<SessionData>({
			supabase: supabase as any,
			table: 'memory',
		}),
	})
)

bot.command('start', async (ctx: any) => {
	ctx.reply(ctx.t('start'), { reply_markup: await buildMainMenu(ctx, games) })
})

bot.callbackQuery('predict', async (ctx: any) => {
	const isPastMatchDay = new Date(games[0].date) <= new Date()

	if (!games || differenceInDays(new Date(games[0].date), new Date()) > 30) {
		return ctx.editMessageText(ctx.t('no_upcoming_games'), {
			reply_markup: buildMenuButton(ctx),
		})
	}

	const usersPredictions = await getPredictionsByUser(
		ctx.from.id,
		games[0].round
	)

	if (isPastMatchDay && !usersPredictions) {
		return ctx.editMessageText(ctx.t('prediction_closed'), {
			reply_markup: buildMenuButton(ctx),
		})
	}

	const gamesWithPrediction: Game[] = []
	const gamesWithoutPrediction: Game[] = []

	games.forEach((game: Game) => {
		const hasPrediction = usersPredictions.some(
			(p: any) => p.game_id === game.game_id
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
	const predictionsList = usersPredictions
		.map(userPredictionIteratee)
		.join('\n')

	const header = hasPredictions ? ctx.t('predicted', { n: roundNumber }) : ''
	const body = predictionsList
	const footer =
		gamesWithoutPrediction.length && !isPastMatchDay
			? ctx.t('match_select')
			: ctx.t('prediction_closed')

	const text = `${header}\n\n${body}\n\n${footer}`

	const replyMarkup = !isPastMatchDay
		? buildRoundMenu(
				ctx,
				games,
				usersPredictions.map((p: any) => p.game_id)
		  )
		: buildMenuButton(ctx)

	await ctx.answerCallbackQuery()
	try {
		await ctx.editMessageText(text, { reply_markup: replyMarkup })
	} catch (err) {
		console.log(err)
		ctx.reply(JSON.stringify(err))
	}
})

bot.on('callback_query:data', async (ctx: any) => {
	const data = ctx.callbackQuery.data

	if (data.startsWith('game_')) {
		await ctx.answerCallbackQuery()

		const game = games.find((game: Game) => game.game_id === parseGameId(data))

		ctx.session.game = game

		if (game)
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
	}

	if (data === 'leaderboard') {
		try {
			const leaderboard = await getLeaderboard()
			if (!leaderboard || !leaderboard.length) {
				await ctx.editMessageText(ctx.t('leaderboard_empty'), {
					reply_markup: buildMenuButton(ctx),
				})
				return
			}

			let table = `${ctx.t('leaderboard_view')}\n\n`
			leaderboard.forEach((p: any, i: any) => {
				table += `${i + 1}. @${p.username} — ${ctx.t('points', {
					pts: p.points,
				})}\n`
			})

			await editHelper(
				() =>
					ctx.editMessageText(table, {
						reply_markup: buildMenuButton(ctx),
					}),
				ctx
			)
			return
		} catch (err) {
			console.error(err)
			await ctx.reply(ctx.t('leaderboard_fail'), {
				reply_markup: buildMenuButton(ctx),
			})
			return
		}
	}

	if (data === 'menu') {
		ctx.editMessageText(ctx.t('start'), {
			reply_markup: await buildMainMenu(ctx, games),
		})
	}

	if (data === 'prev') {
		const usersPredictions = await getPredictionsByUser(
			ctx.from!.id,
			games[0].round - 1
		)
		ctx.editMessageText(
			usersPredictions.map(userPredictionIteratee).join('\n'),
			{ reply_markup: buildMenuButton(ctx) }
		)
	}
})

bot.on('message:text', async (ctx: any) => {
	const msg = ctx.message.text.trim()

	if (ctx.session.game) {
		const score = sanitizeScore(msg)
		const [homeGoals, awayGoals] = score.split('-')
		const { home, away, round, game_id } = ctx.session.game
		try {
			return await saveUserPrediction(
				game_id,
				ctx,
				home,
				away,
				score,
				round
			).then(async () => {
				await ctx.reply(
					ctx.t('prediction_made', {
						n: '\n\n',
						home,
						away,
						homeGoals,
						awayGoals,
					}),
					{ parse_mode: 'MarkdownV2' }
				)
				const predicted = await getPredictionsByUser(ctx.from.id, round).then(
					(data: any) => data.map((p: any) => p.game_id)
				)
				await ctx.reply(ctx.t('match_select'), {
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
				}
			)
		}
	}

	await ctx.reply(ctx.t('fallback'))
})

bot.start()

export type SessionData = {
	game: Game | undefined
}
export type MyContext = Context & SessionFlavor<SessionData> & I18nFlavor
