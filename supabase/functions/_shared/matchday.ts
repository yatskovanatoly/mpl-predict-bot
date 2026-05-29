import { addDays } from 'npm:date-fns@4.1.0/addDays'
import { addHours } from 'npm:date-fns@4.1.0/addHours'
import { differenceInCalendarDays } from 'npm:date-fns@4.1.0/differenceInCalendarDays'
import { startOfDay } from 'npm:date-fns@4.1.0/startOfDay'
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

export type RoundGame = {
	date: string | null
	score: string | null
}

export function mskNow(): Date {
	return addHours(new Date(), 3)
}

export function isFridayMsk(): boolean {
	return mskNow().getDay() === 5
}

export function getGamesForDisplay(
	currentGames: RoundGame[],
	nextGames: RoundGame[],
): RoundGame[] {
	if (!currentGames.length) return nextGames
	if (!nextGames.length) return currentGames

	const currentLastDateRaw = currentGames.at(-1)?.date
	const currentLastDate = currentLastDateRaw
		? new Date(currentLastDateRaw)
		: undefined
	const currentIsActive =
		currentGames.some((game) => !game.score) &&
		!!currentLastDate &&
		!Number.isNaN(currentLastDate.getTime()) &&
		addDays(currentLastDate, 1) >= new Date()

	return currentIsActive ? currentGames : nextGames
}

export function isMatchdayTomorrow(games: RoundGame[]): boolean {
	if (!games.length) return false

	const matchDateRaw = games[0]?.date
	if (!matchDateRaw) return false

	const matchDate = new Date(matchDateRaw)
	if (Number.isNaN(matchDate.getTime())) return false

	const today = startOfDay(mskNow())
	const matchDay = startOfDay(matchDate)
	return differenceInCalendarDays(matchDay, today) === 1
}

export async function fetchCurrentRound(
	supabase: SupabaseClient,
): Promise<RoundGame[]> {
	const { data, error } = await supabase
		.from('current_round')
		.select('date, score')
		.order('time')
	if (error) throw error
	return data ?? []
}

export async function fetchNextRound(
	supabase: SupabaseClient,
): Promise<RoundGame[]> {
	const { data, error } = await supabase
		.from('next_round')
		.select('date, score')
		.order('time')
	if (error) throw error
	return data ?? []
}
