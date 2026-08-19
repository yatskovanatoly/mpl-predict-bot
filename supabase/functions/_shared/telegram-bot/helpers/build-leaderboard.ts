import { MyContext } from '../bot/index.ts'
import { SeasonLeaderboard } from '../lib/supabase-client.ts'
import { formatSeason } from './format-season.ts'

export const buildLeaderboardTitle = (
	ctx: MyContext,
	season?: string | null,
	isArchive = false
) => {
	const label = formatSeason(season)
	if (!label) return ctx.t('leaderboard_view')

	return ctx.t(isArchive ? 'leaderboard_archive_view' : 'leaderboard_season_view', {
		season: label,
	})
}

export const buildLeaderboard = (
	leaderboard: SeasonLeaderboard['data'],
	ctx: MyContext,
	season?: string | null,
	isArchive = false
): string => {
	let table = `${buildLeaderboardTitle(ctx, season, isArchive)}\n\n`

	Object.keys(leaderboard)
		.map(Number)
		.sort((a, b) => a - b)
		.forEach((place) => {
			const users = leaderboard[place]
			const points = users[0].points

			const userList = users
				.map((p) => {
					const name = `${p.first_name}${p.last_name ? ` ${p.last_name}` : ''}`
					const self = ctx.from?.id === p.user_id ? '👤' : ''
					const displayName = p.username ? `@${p.username}` : name

					return self + displayName
				})
				.join(', ')

			table += `${place}. ${userList} — ${ctx.t('points', { pts: points })}\n`
		})

	return table
}
