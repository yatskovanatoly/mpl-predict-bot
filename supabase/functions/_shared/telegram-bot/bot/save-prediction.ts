import { createPrediction } from '../lib/supabase-client.ts'
import { MyContext } from './index.ts'

export async function saveUserPrediction(
	gameId: number,
	ctx: MyContext,
	home: string,
	away: string,
	score: string,
	round: number,
	season: string
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
		round,
		season
	)
}
