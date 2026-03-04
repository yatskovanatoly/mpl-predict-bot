export type RoundData = Game[]

export type Team = {
	id: string
	team: string
	logo?: string | undefined
}

export type Game = {
	game_id: number
	home_id: Team['id']
	away_id: Team['id']
	home_logo: Team['logo']
	away_logo: Team['logo']
	home: Team['team']
	away: Team['team']
	score: string
	time?: string | undefined
	round: number
	date: Date
	season: string
}

export type Rounds = {
	rounds: string[]
	currentRound: string | undefined
}

export type ParamsWithRound = {
	params: Promise<{ round: string }>
}
