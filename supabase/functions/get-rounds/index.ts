import { DOMParser } from "jsr:@b-fuze/deno-dom@0.1.56";
import { createClient } from "jsr:@supabase/supabase-js@2";

export const getRoundGames = async (html: string) => {
	const doc = new DOMParser().parseFromString(html, 'text/html')
	if (!doc) return []

	type Game = {
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
		forfeit?: boolean
	}

	const games: Game[] = []

	const parentDiv = doc.querySelector('#full_forwards')
	if (!parentDiv) return []

	for (const table of parentDiv.querySelectorAll('table.championship')) {
		const stageEl = table.previousElementSibling
		let round = 0
    console.log(round)
		if (
			stageEl?.tagName === 'H1' &&
			stageEl.getAttribute('name') === 'stage_name'
		) {
			const match = stageEl.textContent?.match(/\d+/)
			round = Number(match?.[0]) || 0
		}

		for (const row of table.querySelectorAll('tbody tr.game')) {
			const time = row.querySelector('td.date')?.textContent.trim() ?? ''
			const homeEl = row.querySelector('td.home a')
			const homeImg = row.querySelector('td.home img')
			const awayEl = row.querySelector('td.away a')
			const awayImg = row.querySelector('td.away img')
			const scoreEl = row.querySelector('td.score a')
			const scoreText = scoreEl?.textContent.trim() ?? ''
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
				home_goals: Number(scoreText.split(':')[0]) ?? undefined,
				away_goals: Number(scoreText.split(':')[1]) ?? undefined,
				events_url: scoreEl?.getAttribute('href') ?? '',
				round,
			})
		}
	}

	const forfeitsToCheck = games
		.filter(
			(g) =>
				(g.home_goals === 0 && g.away_goals === 3) ||
				(g.home_goals === 3 && g.away_goals === 0)
		)
		.map(async (g) => {
			const forfeit = await isTechnicalResult(g.game_id)
			g.forfeit = forfeit
		})

	await Promise.all(forfeitsToCheck)

	return games
}

export const isTechnicalResult = async (gameId: number): Promise<boolean> => {
	const url = `https://mychamp.ru/championships/202/games/${gameId}/events`

	const res = await fetch(url)
	if (!res.ok) {
		console.error(`Failed to fetch game page for ${gameId}: ${res.status}`)
		return false
	}

	const html = await res.text()
	const doc = new DOMParser().parseFromString(html, 'text/html')
	if (!doc) return false

	const scoreColumn = doc.querySelector(
		'div.col-sm-2.col-xs-4.score_column.text-center.text-nowrap'
	)

	if (!scoreColumn) return false

	return scoreColumn.textContent.includes('Технический результат')
}

Deno.serve(async () => {
	const url =
		'https://mychamp.ru/championships/202/games?configuration[type]=games'

	const res = await fetch(url)
	const html = await res.text()
	const games = await getRoundGames(html)

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
