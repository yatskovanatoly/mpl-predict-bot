import { PredictionRow } from '../lib/supabase-client.ts'
import { MyContext } from './index.ts'

export const userPredictionIteratee = ({
	home_team,
	away_team,
	home_goals,
	away_goals,
	game_result,
	status,
}: PredictionRow & { ctx: MyContext }) =>
	`${home_team} – ${away_team} → ${home_goals}:${away_goals} ${
		game_result && status !== 'score' ? `(${game_result})` : ''
	}`
