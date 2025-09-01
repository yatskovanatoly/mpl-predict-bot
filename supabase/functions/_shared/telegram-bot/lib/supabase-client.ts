import type { User } from 'npm:@grammyjs/types'
import { supabase } from '../bot/index.ts'
import { Database } from '../database.types.ts'
import { Game } from './types.ts'

export async function getCurrentRound(): Promise<Game[]> {
	const { data, error } = await supabase
		.from('current_round')
		.select('*')
		.order('time')
	if (error) throw error
	return data
}

export async function getAllGames(): Promise<Game[]> {
	const { data, error } = await supabase.from('games').select('*')
	if (error) throw error
	return data
}

export async function getLeaderboard(): Promise<LeaderboardRow[]> {
	const { data, error } = await supabase
		.from('leaderboard')
		.select('*')
		.gt('points', 0)
		.limit(10)
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
		.eq('user_id', userId)
		.maybeSingle()
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
			first_name: tgUser.first_name,
			last_name: tgUser.last_name,
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
	if (!userId || !round) return []
	const { data, error } = await supabase
		.from('predictions')
		.select('*')
		.eq('user_id', userId)
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

// NB DEV
export async function updateId(tgUser: User): Promise<any> {
	try {
		const { data } = await supabase
			.from('leaderboard')
			.upsert(
				{ username: null, user_id: tgUser.id },
				{ onConflict: 'username' }
			)
			.select()
			.single()

		return data
	} catch (err) {
		console.log(err)
	}
}

export type LeaderboardRow = {
	user_id: string
	username?: string
	first_name: string
	last_name?: string
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
	game_result: Database['public']['Tables']['predictions']['Row']['game_result']
	status: Database['public']['Tables']['predictions']['Row']['status']
}
