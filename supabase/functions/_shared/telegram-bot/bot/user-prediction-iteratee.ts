import { Database } from '../database.types.ts'
import { PredictionRow } from '../lib/supabase-client.ts'

export const userPredictionIteratee = ({
	home_team,
	away_team,
	home_goals,
	away_goals,
	status,
}: PredictionRow) =>
	`${home_team} – ${away_team} → ${home_goals}:${away_goals} ${
		status ? statusMap[status] : ''
	}`

const statusMap: Record<Database['public']['Enums']['status'], string> = {
	score: '🎯',
	difference: '⚖️',
	winner: '🎲',
}
