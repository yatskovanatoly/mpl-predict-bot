export type RoundData = {
	date: Date
	games: Game[]
	round: number
}

export type Team = {
	id: string
	team: string
	logo?: string | undefined
}

export type Game = {
	id: number
	home: Team
	away: Team
	score: string
	time?: string | undefined
	game_id: number
	round: number
	date: Date
}

export type Rounds = {
	rounds: string[]
	currentRound: string | undefined
}

export type ParamsWithRound = {
	params: Promise<{ round: string }>
}
