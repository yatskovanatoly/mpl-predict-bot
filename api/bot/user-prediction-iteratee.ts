import type { PredictionRow } from '../lib/supabase-client'

export const userPredictionIteratee = ({
	home_team,
	away_team,
	home_goals,
	away_goals,
}: PredictionRow) => `${home_team} – ${away_team} → ${home_goals}:${away_goals}`
