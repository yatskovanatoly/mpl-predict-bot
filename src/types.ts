import type { GrammyError } from "grammy"

export type RoundData = {
	date: string
	games: Game[]
}

export type Round = {
	stage: string
	games: Game[]
}

export type Team = {
	id: string
	team: string
	logo?: string
}

export type Game = {
  id: number
	home: Team
	away: Team
	score: string
	time?: string | undefined
  game_id: number
}

export type Rounds = {
	rounds: string[]
	currentRound: string | undefined
}

export type ParamsWithRound = {
	params: Promise<{ round: string }>
}