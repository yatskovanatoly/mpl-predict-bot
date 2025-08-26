// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { DOMParser } from 'jsr:@b-fuze/deno-dom'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const headers = {
	'Content-Type': 'application/json',
}
// Utility: parse games
export const getRoundGames = (html: string) => {
	const doc = new DOMParser().parseFromString(html, 'text/html')
	if (!doc) return []
	const games: {
		game_id: number
		time: string
		home_id: string
		home_name: string
		home_logo: string
		away_id: string
		away_name: string
		away_logo: string
		score: string
		events_url: string
		round: number
	}[] = []
	const parentDiv = doc.querySelector('#full_forwards')
	// Loop over each championship table
	parentDiv!.querySelectorAll('table.championship').forEach((table) => {
		// Find the preceding <h1 name="stage_name"> for this table
		const stageEl = table.previousElementSibling
		let round: number
		if (
			stageEl?.tagName === 'H1' &&
			stageEl.getAttribute('name') === 'stage_name'
		) {
			// Extract the number from "Тур 1"
			const match = stageEl.textContent?.match(/\d+/)
			round = Number(match![0])
		}
		// Loop over each row in the table
		table.querySelectorAll('tbody tr.game').forEach((row) => {
			const time = row.querySelector('td.date')?.textContent.trim() ?? ''
			const homeEl = row.querySelector('td.home a')
			const homeImg = row.querySelector('td.home img')
			const awayEl = row.querySelector('td.away a')
			const awayImg = row.querySelector('td.away img')
			const scoreEl = row.querySelector('td.score a')
			const game_id = Number(
				scoreEl?.getAttribute('href')?.split('/').at(-2) ?? 0
			)
			games.push({
				game_id,
				time,
				home_id: row.querySelector('td.home')?.getAttribute('name') ?? '',
				home_name: homeEl?.textContent.trim() ?? '',
				home_logo: homeImg?.getAttribute('src') ?? '',
				away_id: row.querySelector('td.away')?.getAttribute('name') ?? '',
				away_name: awayEl?.textContent.trim() ?? '',
				away_logo: awayImg?.getAttribute('src') ?? '',
				score: scoreEl?.textContent.trim() ?? '',
				events_url: scoreEl?.getAttribute('href') ?? '',
				round,
			})
		})
	})
	return games
}
Deno.serve(async () => {
	const url =
		'https://mychamp.ru/championships/202/games?configuration[type]=games' // replace dynamically
	// 1. Fetch and parse games
	const res = await fetch(url)
	const html = await res.text()
	const games = getRoundGames(html)
	// return new Response(JSON.stringify(games.map((g)=>g.round)));
	// 2. Create Supabase client (Edge functions get env vars automatically)
	const supabase = createClient(
		Deno.env.get('SUPABASE_URL') ?? '',
		Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // service role required for inserts
	)
	// 3. Insert into your Supabase table
	// Replace "games" with your actual table name
	const { data, error } = await supabase
		.from('games')
		.upsert(games, {
			onConflict: 'game_id',
		})
		.select()
	if (error) {
		return new Response(
			JSON.stringify({
				error: error.message,
			}),
			{
				status: 500,
				headers,
			}
		)
	}
	return new Response(
		JSON.stringify({
			inserted: data?.length ?? 0,
			data,
		}),
		{
			headers,
		}
	)
})
