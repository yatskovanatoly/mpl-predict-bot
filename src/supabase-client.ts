// supabaseClient.ts
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'
import type { User } from 'grammy/types'

// Types
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
}

// Init
const supabaseUrl = process.env.SUPABASE_URL as string
const supabaseKey = process.env.SUPABASE_ANON_KEY as string
export const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * Leaderboard functions
 */
export async function getLeaderboard(): Promise<LeaderboardRow[]> {
	const { data, error } = await supabase
		.from('leaderboard')
		.select('*')
		.order('points', { ascending: false })
	if (error) throw error
	return data
}

export async function getUserByUsername(
	username?: string
): Promise<LeaderboardRow | null> {
	const { data, error } = await supabase
		.from('leaderboard')
		.select('*')
		.eq('username', username)
		.maybeSingle()
	if (error) throw error
	return data
}

export async function updateScore(
	userId: string,
	delta: number
): Promise<LeaderboardRow> {
	// Fetch current score
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

/**
 * Predictions functions
 */
export async function createPrediction(
	tgUser: User,
	gameId: string,
	homeTeam: string,
	awayTeam: string,
	homeGoals: number,
	awayGoals: number
): Promise<PredictionRow> {
	const { data, error } = await supabase
		.from('predictions')
		.insert({
			user_id: tgUser.id,
			game_id: parseInt(gameId.replace('game_', '')),
			home_team: homeTeam,
			away_team: awayTeam,
			home_goals: homeGoals,
			away_goals: awayGoals,
			username: tgUser.username,
			round: 1,
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
	username: string
): Promise<PredictionRow[]> {
	const user = await getUserByUsername(username)
	if (!user) return []
	const { data, error } = await supabase
		.from('predictions')
		.select('*')
		.eq('user_id', user.id)
		.order('created_on', { ascending: false })
	if (error) throw error
	return data
}

export async function getAllPredictions(): Promise<PredictionRow[]> {
	const { data, error } = await supabase
		.from('predictions')
		.select('*')
		.order('created_on', { ascending: false })
	if (error) throw error
	return data
}
