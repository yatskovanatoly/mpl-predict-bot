import {
	Bot,
	Context,
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

const token = process.env.TELEGRAM_BOT_TOKEN
if (!token) throw new Error('TELEGRAM_BOT_TOKEN is missing')
const bot = new Bot<MyContext>(token)
const games = await getData()

bot.use(
	session({
		initial: (): SessionData => ({ game: undefined }),
		storage: new MemorySessionStorage(),
	})
)

// --- /start ---
bot.command('start', (ctx) => {
	ctx.reply('Welcome! Choose an option:', { reply_markup: menu })
})

// --- Main Menu Keyboard ---
const menu = new InlineKeyboard()
	.text('⚽ Make Prediction', 'predict')
	.row()
	.text('📊 See Table', 'leaderboard')

// --- Dynamic Games Keyboard ---
const roundMenu = new InlineKeyboard()
games.games.forEach(({ id, home, away }) => {
	roundMenu.text(`${home.team} — ${away.team}`, `${id}`)
	roundMenu.row()
})

bot.callbackQuery('predict', async (ctx) => {
	await ctx.answerCallbackQuery()
	await ctx.editMessageText('Select a match to predict:', {
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
			`Какой счёт будет в матче ${game?.home.team} - ${game?.away.team}?`
		)
	}
	if (data === 'leaderboard') {
		try {
			const leaderboard = await getLeaderboard()
			console.log(leaderboard)
			if (!leaderboard || leaderboard.length === 0) {
				await ctx.reply('No data yet.')
				return
			}

			let table = '📊 Leaderboard:\n\n'
			leaderboard.forEach((p, i) => {
				table += `${i + 1}. ${p.username} — ${p.points} pts\n`
			})

			await ctx.reply(table)
			return
		} catch (err) {
			console.error(err)
			await ctx.reply('❌ Could not load leaderboard.')
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
				`✅ Prediction saved: *${home.team}* : *${away.team}* → ${homeGoals}\\-${awayGoals}`,
				{ parse_mode: 'MarkdownV2' }
			)
			return (ctx.session.game = undefined)
		} catch (err) {
			console.error(err)
			await ctx.reply(
				`❌ Failed to save prediction. Make sure format is correct. \n ${JSON.stringify(
					err
				)}`
			)
		}
	}

	// Fallback
	await ctx.reply('Use the menu or follow instructions.')
	return (ctx.session.game = undefined)
})

bot.start()

type SessionData = { game: Game | undefined }
type MyContext = Context & SessionFlavor<SessionData>
