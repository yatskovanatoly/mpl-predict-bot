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

export async function getLeaderboardGrouped(page = 1): Promise<any> {
	const { data, error } = await supabase.rpc('get_leaderboard_by_points', {
		page,
	})

	if (error) throw error
	return data
}

export async function getNextRound(): Promise<Game[]> {
	const { data, error } = await supabase
		.from('next_round')
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
	round: number,
	season: string
): Promise<PredictionRow> {
	const { data, error } = await supabase
		.from('predictions')
		.upsert(
			{
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
				season,
			},
			{ onConflict: 'game_id, user_id,season' }
		)
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
	round: number,
	season?: string
): Promise<PredictionRow[]> {
	if (!userId || !round) return []
	let query = supabase
		.from('predictions')
		.select('*')
		.eq('user_id', userId)
		.eq('round', round)
		.order('created_at', { ascending: false })
	if (season) query = query.eq('season', season)
	const { data, error } = await query
	if (error) throw error
	return data
}

export async function getUserRoundsWithPredictions(
	userId: number,
	season?: string
): Promise<number[]> {
	if (!userId) return []
	let query = supabase
		.from('predictions')
		.select('round')
		.eq('user_id', userId)
		.not('round', 'is', null)
		.order('round', { ascending: false })
	if (season) query = query.eq('season', season)
	const { data, error } = await query
	if (error) throw error
	const rounds = (data ?? [])
		.map((row) => row.round)
		.filter((round): round is number => typeof round === 'number')
	return [...new Set(rounds)]
}

export async function getAllRoundsWithPredictions(): Promise<number[]> {
	const { data, error } = await supabase
		.from('predictions')
		.select('round')
		.not('round', 'is', null)
		.order('round', { ascending: false })
	if (error) throw error
	const rounds = (data ?? [])
		.map((row) => row.round)
		.filter((round): round is number => typeof round === 'number')
	return [...new Set(rounds)]
}

export async function getAllRoundsFromGames(): Promise<number[]> {
	const { data: currentRoundRow } = await supabase
		.from('current_round')
		.select('round,season')
		.not('round', 'is', null)
		.limit(1)
		.maybeSingle()

	const currentRound =
		typeof currentRoundRow?.round === 'number' ? currentRoundRow.round : null
	const currentSeason =
		typeof currentRoundRow?.season === 'string' ? currentRoundRow.season : null

	let query = supabase
		.from('games')
		.select('round')
		.not('round', 'is', null)
		.order('round', { ascending: false })
	if (currentSeason) query = query.eq('season', currentSeason)
	const { data, error } = await query
	if (error) throw error
	const rounds = (data ?? [])
		.map((row) => row.round)
		.filter((round): round is number => typeof round === 'number')
	const uniqueRounds = [...new Set(rounds)]

	if (currentRound === null) return uniqueRounds

	// Keep full past history, but expose at most one future round.
	return uniqueRounds.filter((round) => round <= currentRound + 1)
}

export async function getUsersWithPredictionsByRound(
	round: number,
	excludeUserId?: number,
	season?: string
): Promise<PredictionUserRow[]> {
	if (!round) return []
	let query = supabase
		.from('predictions')
		.select('user_id,username,first_name,last_name')
		.eq('round', round)
		.not('user_id', 'is', null)
		.order('created_at', { ascending: true })

	if (season) {
		query = query.eq('season', season)
	}

	if (excludeUserId) {
		query = query.neq('user_id', excludeUserId)
	}

	const { data, error } = await query
	if (error) throw error

	const users = (data ?? [])
		.map((row) => ({
			user_id: Number(row.user_id),
			username: row.username,
			first_name: row.first_name,
			last_name: row.last_name,
		}))
		.filter((row) => Number.isFinite(row.user_id))

	const seen = new Set<number>()
	const unique: PredictionUserRow[] = []
	for (const user of users) {
		if (seen.has(user.user_id)) continue
		seen.add(user.user_id)
		unique.push(user)
	}
	return unique
}

export async function getAllPredictions(): Promise<PredictionRow[]> {
	const { data, error } = await supabase
		.from('predictions')
		.select('*')
		.order('created_at', { ascending: false })
	if (error) throw error
	return data
}

export async function getPredictionsByRound(
	round: number,
	season?: string
): Promise<PredictionRoundRow[]> {
	if (!round) return []
	let query = supabase
		.from('predictions')
		.select('game_id,home_goals,away_goals')
		.eq('round', round)
		.not('game_id', 'is', null)
		.not('home_goals', 'is', null)
		.not('away_goals', 'is', null)
	if (season) query = query.eq('season', season)
	const { data, error } = await query
	if (error) throw error
	return (data ?? []).map((row) => ({
		game_id: Number(row.game_id),
		home_goals: Number(row.home_goals),
		away_goals: Number(row.away_goals),
	}))
}

export async function hasPredictionsByRound(
	round: number,
	season?: string
): Promise<boolean> {
	if (!round) return false
	let query = supabase
		.from('predictions')
		.select('id')
		.eq('round', round)
		.limit(1)
	if (season) query = query.eq('season', season)
	const { data, error } = await query
	if (error) throw error
	return (data?.length ?? 0) > 0
}

// NB DEV
export async function updateId(tgUser: User): Promise<any> {
	try {
		const { data } = await supabase
			.from('leaderboard')
			.upsert(
				{ user_id: tgUser.id, username: tgUser.username },
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
	username: string | null
	first_name: string | null
	last_name: string | null
	home_team: string
	away_team: string
	home_goals: number
	away_goals: number
	created_on: string
	game_id: number
	round: number
	season: string | null
	game_result: Database['public']['Tables']['predictions']['Row']['game_result']
	status: Database['public']['Tables']['predictions']['Row']['status']
}

export type PredictionUserRow = {
	user_id: number
	username: string | null
	first_name: string | null
	last_name: string | null
}

export type PredictionRoundRow = {
	game_id: number
	home_goals: number
	away_goals: number
}
