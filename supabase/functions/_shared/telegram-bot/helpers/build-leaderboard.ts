import { MyContext } from '../bot/index.ts'

export const buildLeaderboard = (
	leaderboard: LeaderboardResult,
	ctx: MyContext
): string => {
	let table = `${ctx.t('leaderboard_view')}\n\n`

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

type LeaderboardRow = {
	user_id: number
	username: string | null
	first_name: string
	last_name: string | null
	points: number
}

type LeaderboardResult = Record<number, LeaderboardRow[]>
