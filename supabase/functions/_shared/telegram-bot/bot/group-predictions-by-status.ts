import { PredictionRow } from '../lib/supabase-client.ts'

export const groupPredictionsByStatus = (
	games: PredictionRow[]
): Record<string, PredictionRow[]> => {
	return games.reduce((acc: Record<string, PredictionRow[]>, game) => {
		if (game.status) {
			if (!acc[game.status]) {
				acc[game.status] = []
			}
			acc[game.status].push(game)
		}
		if (!game.status) {
			if (!acc['no status']) {
				acc['no status'] = []
			}
			acc['no status'].push(game)
		}
		return acc
	}, {})
}
