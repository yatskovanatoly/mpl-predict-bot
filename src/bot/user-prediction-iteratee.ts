import type { PredictionRow } from '../../lib/supabase-client.js'

export const userPredictionIteratee = ({
	home_team,
	away_team,
	home_goals,
	away_goals,
}: PredictionRow) => `${home_team} – ${away_team} → ${home_goals}:${away_goals}`
