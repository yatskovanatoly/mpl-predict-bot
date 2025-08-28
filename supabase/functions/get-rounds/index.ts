import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { DOMParser } from 'jsr:@b-fuze/deno-dom'
import { createClient } from 'jsr:@supabase/supabase-js@2'

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
		home_goals: number | undefined
		away_goals: number | undefined
		events_url: string
		round: number
	}[] = []

	const parentDiv = doc.querySelector('#full_forwards')
	parentDiv!.querySelectorAll('table.championship').forEach((table) => {
		const stageEl = table.previousElementSibling
		let round: number
		if (
			stageEl?.tagName === 'H1' &&
			stageEl.getAttribute('name') === 'stage_name'
		) {
			const match = stageEl.textContent?.match(/\d+/)
			round = Number(match![0])
		}
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
				home_goals:
					Number(scoreEl?.textContent.trim().split(':')[0]) ?? undefined,
				away_goals:
					Number(scoreEl?.textContent.trim().split(':')[1]) ?? undefined,
				events_url: scoreEl?.getAttribute('href') ?? '',
				round,
			})
		})
	})
	return games
}

Deno.serve(async () => {
	const url =
		'https://mychamp.ru/championships/202/games?configuration[type]=games'

	const res = await fetch(url)
	const html = await res.text()
	const games = getRoundGames(html)

	const supabase = createClient(
		Deno.env.get('SUPABASE_URL') ?? '',
		Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
	)

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
		}),
		{
			headers,
		}
	)
})

const headers = {
	'Content-Type': 'application/json',
}
