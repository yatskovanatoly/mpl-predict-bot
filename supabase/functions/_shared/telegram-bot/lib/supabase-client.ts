import type { User } from 'npm:@grammyjs/types'
import { supabase } from '../bot/index.ts'
import { Game } from './types.ts'

export async function getGames(): Promise<Game[]> {
	const { data, error } = await supabase
		.from('current_round')
		.select('*')
		.order('round', { ascending: false })
	if (error) throw error
	return data
}

export async function getLeaderboard(): Promise<LeaderboardRow[]> {
	const { data, error } = await supabase
		.from('leaderboard')
		.select('*')
		.gt('points', 0)
		.order('points', { ascending: false })
	if (error) throw error
	return data
}

export async function getUserById(
	userId: number
): Promise<LeaderboardRow | null> {
	const { data, error } = await supabase
		.from('leaderboard')
		.select('*')
		.eq('id', userId)
		.maybeSingle()
	if (error) throw error
	return data
}

export async function updateScore(
	userId: string,
	delta: number
): Promise<LeaderboardRow> {
	const { data: user, error: fetchError } = await supabase
		.from('leaderboard')
		.select('score')
		.eq('id', userId)
		.single()
	if (fetchError) throw fetchError

	const newScore = (user?.score ?? 0) + delta

	const { data, error } = await supabase
		.from('leaderboard')
		.update({ score: newScore })
		.eq('id', userId)
		.select()
		.single()
	if (error) throw error
	return data
}

export async function createPrediction(
	tgUser: User,
	gameId: number,
	homeTeam: string,
	awayTeam: string,
	homeGoals: number,
	awayGoals: number,
	round: number
): Promise<PredictionRow> {
	const { data, error } = await supabase
		.from('predictions')
		.insert({
			user_id: tgUser.id,
			game_id: gameId,
			home_team: homeTeam,
			away_team: awayTeam,
			home_goals: homeGoals,
			away_goals: awayGoals,
			username: tgUser.username,
			round,
		})
		.select()
		.single()
	if (error) {
		console.log(error)
		throw error
	}
	return data
}

export async function getPredictionsByUser(
	userId: number,
	round: number
): Promise<PredictionRow[]> {
	const user = await getUserById(userId)
	if (!user) return []
	const { data, error } = await supabase
		.from('predictions')
		.select('*')
		.eq('user_id', user.id)
		.eq('round', round)
		.order('created_at', { ascending: false })
	if (error) throw error
	return data
}

export async function getAllPredictions(): Promise<PredictionRow[]> {
	const { data, error } = await supabase
		.from('predictions')
		.select('*')
		.order('created_at', { ascending: false })
	if (error) throw error
	return data
}

export type LeaderboardRow = {
	id: string
	username: string
	points: number
	created_on: string
}

export type PredictionRow = {
	id: string
	user_id: string
	home_team: string
	away_team: string
	home_goals: number
	away_goals: number
	created_on: string
	game_id: number
	round: number
}
