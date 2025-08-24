import type { User } from 'grammy/types'
import { createPrediction } from '../supabase-client.js'

export async function saveUserPrediction(
	gameId: string,
	tgUser: User,
	home: string,
	away: string,
	score: string
) {
	const [homeGoalsStr, awayGoalsStr] = score.split('-')
	const homeGoals = parseInt(homeGoalsStr!, 10)
	const awayGoals = parseInt(awayGoalsStr!, 10)

	if (isNaN(homeGoals) || isNaN(awayGoals)) {
		throw new Error('Invalid score format')
	}

	return await createPrediction(
		tgUser,
		gameId,
		home,
		away,
		homeGoals,
		awayGoals
	)
}
