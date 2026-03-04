import { InlineKeyboard } from 'npm:grammy@1.39.3'
import { addHours } from 'npm:date-fns@4.1.0/addHours'
import { MyContext } from '../bot/index.ts'
import {
	getPredictionsByUser,
	hasPredictionsByRound,
	PredictionRow,
} from '../lib/supabase-client.ts'
import { Game } from '../lib/types.ts'
import { sanitizeTeamName } from './sanitize-team-name.ts'

export const buildMainMenu = async (ctx: MyContext, games: Game[]) => {
	const kb = new InlineKeyboard()
	if (!games.length) {
		kb.text(ctx.t('predict'), 'predict').row()
		kb.text(ctx.t('my_rounds'), 'my_rounds').row()
		kb.text(ctx.t('others_rounds'), 'others_rounds').row()
		kb.text(ctx.t('leaderboard'), 'leaderboard')
		return kb
	}

	const isPastMatchDay = new Date(games[0].date) <= addHours(new Date(), 3)
	const prevRound = games[0].round - 1
	const currentRoundPredictions =
		(await getPredictionsByUser(
			ctx.from!.id,
			games[0].round,
			games[0].season,
		)) || []
	const prevRoundPredictions =
		prevRound > 0
			? await getPredictionsByUser(ctx.from!.id, prevRound, games[0].season)
			: []
	const hasUpcomingPredictions = await hasPredictionsByRound(
		games[0].round,
		games[0].season,
	)

	kb.text(
		ctx.t(
			isPastMatchDay || currentRoundPredictions.length === games.length
				? 'predict_my'
				: 'predict'
		),
		'predict'
	).row()

	if (games[0].round > 1) {
		if (prevRoundPredictions.length)
			kb.text(ctx.t('prev', { n: prevRound }), 'prev').row()
	}

	kb.text(ctx.t('my_rounds'), 'my_rounds').row()
	kb.text(ctx.t('others_rounds'), 'others_rounds').row()
	if (hasUpcomingPredictions) {
		kb.text(ctx.t('upcoming_percentages'), 'upcoming_percentages').row()
	}
	kb.text(ctx.t('leaderboard'), 'leaderboard')

	return kb
}

export const buildRoundMenu = (
	ctx: MyContext,
	games: Game[],
	userPredictions: number[]
) => {
	const kb = new InlineKeyboard()

	games.forEach(({ game_id, home, away }) => {
		if (!userPredictions.includes(game_id)) {
			kb.text(
				`${sanitizeTeamName(home)} — ${sanitizeTeamName(away)}`,
				`game_${game_id}`
			).row()
		}
	})

	kb.text(ctx.t('menu'), 'menu')

	if (userPredictions.length > 0) {
		kb.text(ctx.t('edit_prediction'), 'edit').row()
	}

	return kb
}

export const buildMenuButton = (ctx: MyContext) =>
	new InlineKeyboard().text(ctx.t('menu'), 'menu')

export const buildRoundsMenu = (
	ctx: MyContext,
	rounds: number[],
	callbackPrefix: string,
	page = 1,
	pageSize = 8
) => {
	const kb = new InlineKeyboard()
	const totalPages = Math.max(1, Math.ceil(rounds.length / pageSize))
	const safePage = Math.min(Math.max(1, page), totalPages)
	const start = (safePage - 1) * pageSize
	const end = start + pageSize
	const pageRounds = rounds.slice(start, end)

	pageRounds.forEach((round) => {
		kb.text(`${round}-й тур`, `${callbackPrefix}${round}`).row()
	})

	if (totalPages > 1) {
		const prevPage = Math.max(1, safePage - 1)
		const nextPage = Math.min(totalPages, safePage + 1)
		kb.text(ctx.t('back'), `${callbackPrefix}page_${prevPage}`)
		kb.text(`${safePage}/${totalPages}`, `${callbackPrefix}noop`)
		kb.text(ctx.t('forward'), `${callbackPrefix}page_${nextPage}`).row()
	}
	kb.text(ctx.t('menu'), 'menu')
	return kb
}

export const buildUsersMenu = (
	ctx: MyContext,
	users: {
		user_id: number
		username: string | null
		first_name: string | null
		last_name: string | null
	}[],
	round: number,
	page = 1,
	pageSize = 10
) => {
	const kb = new InlineKeyboard()
	const totalPages = Math.max(1, Math.ceil(users.length / pageSize))
	const safePage = Math.min(Math.max(1, page), totalPages)
	const start = (safePage - 1) * pageSize
	const end = start + pageSize
	const pageUsers = users.slice(start, end)

	pageUsers.forEach((user) => {
		const label = user.username
			? `@${user.username}`
			: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() ||
				`${user.user_id}`
		kb.text(label, `ou_${round}_${user.user_id}`).row()
	})

	if (totalPages > 1) {
		const prevPage = Math.max(1, safePage - 1)
		const nextPage = Math.min(totalPages, safePage + 1)
		kb.text(ctx.t('back'), `ou_page_${round}_${prevPage}`)
		kb.text(`${safePage}/${totalPages}`, `ou_page_${round}_${safePage}`)
		kb.text(ctx.t('forward'), `ou_page_${round}_${nextPage}`).row()
	}
	kb.text(ctx.t('menu'), 'menu')
	return kb
}

export const buildEditMenu = (ctx: MyContext, games: PredictionRow[]) => {
	const kb = new InlineKeyboard()

	games.forEach(({ game_id, home_team, home_goals, away_team, away_goals }) => {
		kb.text(
			`${home_team} — ${away_team} → ${home_goals}:${away_goals}`,
			`edit_${game_id}`
		).row()
	})

	kb.text(ctx.t('menu'), 'menu')

	return kb
}

export const buildLeaderboardMenu = (
	ctx: MyContext,
	// deno-lint-ignore no-explicit-any
	leaderboardGrouped: Record<string, any>
) => {
	const kb = new InlineKeyboard()

	kb.text(ctx.t('back'), 'leaderboard_previous')
	kb.text(
		`${leaderboardGrouped.page} / ${leaderboardGrouped.total_pages}`,
		'leaderboard_first_page'
	)
	kb.text(ctx.t('forward'), 'leaderboard_next').row()
	kb.text(ctx.t('menu'), 'menu')

	return kb
}
