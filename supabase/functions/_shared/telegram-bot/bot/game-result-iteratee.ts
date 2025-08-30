import { Game } from '../lib/types.ts'

export const gameResultIteratee = ({ home, away, score }: Game) =>
	`${home} – ${away} (${score})`
