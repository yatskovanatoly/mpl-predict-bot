export const buildLeaderboard = (
	leaderboard: LeaderboardResult,
	ctx: any
): string => {
	let table = `${ctx.t('leaderboard_view')}\n\n`

	// Places are object keys, so we sort them numerically
	Object.keys(leaderboard)
		.map(Number)
		.sort((a, b) => a - b)
		.forEach((place) => {
			const users = leaderboard[place]
			const points = users[0].points // all in same place have equal points

			// Join all users for this place
			const userList = users
				.map((p) => {
					const name = `${p.first_name}${p.last_name ? ` ${p.last_name}` : ''}`
					return p.username ? `@${p.username}` : name
				})
				.join(', ')

			// Add to leaderboard string
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

type LeaderboardResult = Record<number, LeaderboardRow[]> // { place: [users] }
