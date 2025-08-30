import { PredictionRow } from '../lib/supabase-client.ts'
import { MyContext } from './index.ts'
import { userPredictionIteratee } from './user-prediction-iteratee.ts'

export const formatUserPredictions = (
	games: Record<
		'no status' | 'winner' | 'score' | 'difference',
		PredictionRow[]
	>,
	ctx: MyContext
) => {
	let result = ''

	const appendPredictions = (
		category: 'no status' | 'winner' | 'score' | 'difference',
		headerKey?: string
	) => {
		if (games[category] && games[category].length > 0) {
			const header = headerKey ? `\n\n${ctx.t(headerKey)}:\n` : ''
			result += `${header}${games[category]
				.map((game) => userPredictionIteratee({ ...game, ctx }))
				.join('\n')}`
		}
	}

	appendPredictions('no status')
	appendPredictions('score', 'score')
	appendPredictions('difference', 'difference')
	appendPredictions('winner', 'winner')
	return result
}
