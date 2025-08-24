import type { User } from 'grammy/types'
import { createPrediction } from '../supabase-client.js'
import type { MyContext } from './index.js'

export async function saveUserPrediction(
	gameId: number,
	ctx: MyContext,
	home: string,
	away: string,
	score: string,
	round: number
) {
	const [homeGoalsStr, awayGoalsStr] = score.split('-')
	const homeGoals = parseInt(homeGoalsStr!, 10)
	const awayGoals = parseInt(awayGoalsStr!, 10)

	if (isNaN(homeGoals) || isNaN(awayGoals)) {
		throw new Error(ctx.t('error_score'))
	}

	return await createPrediction(
		ctx.from!,
		gameId,
		home,
		away,
		homeGoals,
		awayGoals,
		round
	)
}
