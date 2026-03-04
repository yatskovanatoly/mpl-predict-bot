import { Document, DOMParser } from 'jsr:@b-fuze/deno-dom@0.1.56'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { isValid } from 'npm:date-fns@^4.1.0/isValid'
import { parse } from 'npm:date-fns@^4.1.0'
import { ru } from 'npm:date-fns@^4.1.0/locale'
import { sanitizeTeamName } from '../_shared/telegram-bot/helpers/sanitize-team-name.ts'
import { Game, RoundData } from '../_shared/telegram-bot/lib/types.ts'
import { BASE_URL, MPL_ID } from '../_shared/telegram-bot/lib/urls.ts'

const inferRoundDate = (
	dateText: string,
	referenceDate = new Date(),
	options?: { preferOnOrAfter?: Date },
) => {
	const baseYear = referenceDate.getFullYear()
	const candidates = [baseYear - 1, baseYear, baseYear + 1, baseYear + 2]
		.map((year) =>
			parse(`${dateText} ${year}`, 'd MMMM, EEEE yyyy', referenceDate, {
				locale: ru,
			})
		)
		.filter((date) => isValid(date))

	if (!candidates.length) return referenceDate

	const preferOnOrAfter = options?.preferOnOrAfter
	if (preferOnOrAfter) {
		const fromTs = preferOnOrAfter.getTime()
		const futureOrSame = candidates
			.filter((date) => date.getTime() >= fromTs)
			.sort((a, b) => a.getTime() - b.getTime())
		if (futureOrSame.length) return futureOrSame[0]
	}

	return candidates.sort((a, b) => {
		const aDelta = Math.abs(a.getTime() - referenceDate.getTime())
		const bDelta = Math.abs(b.getTime() - referenceDate.getTime())
		return aDelta - bDelta
	})[0]
}

const getDocument = async (roundN?: number): Promise<Document> => {
	const response = await fetch(
		`https://${BASE_URL}/championships/${MPL_ID}/games` +
			`${roundN ? `?round=${roundN.toString()}` : ''}`,
	)
	const html = await response.text()
	const doc = new DOMParser().parseFromString(html, 'text/html')
	if (!doc) throw new Error('Failed to parse HTML')
	return doc
}

const getCurrentRound = async (
	roundN?: number,
	dateOptions?: { preferOnOrAfter?: Date },
): Promise<RoundData> => {
	const games: Game[] = []
	const doc = await getDocument(roundN)

	const date = doc.querySelector('.category2')?.textContent.trim() ?? ''
	const roundText =
		doc.querySelector('.current')?.textContent?.trim() ?? roundN?.toString() ?? '0'
	const round = Number(roundText.match(/\d+/)?.[0] ?? roundN ?? 0)
	const roundDate = inferRoundDate(date, new Date(), dateOptions)

	try {
		doc.querySelectorAll('.result').forEach((el) => {
			const row = el.querySelector('.row')?.children ?? []
			const parent = el.parentElement
			if (!parent) return

			const idAttr = parent.getAttribute('id')
			if (!idAttr) return
			const game_id = Number(idAttr.replace('game_', ''))
			const time = parent.querySelector('.date')?.textContent.trim() ?? ''

			const game: Game = {
				game_id,
				round,
				home_id: '',
				home: '',
				home_logo: undefined,
				away_id: '',
				away: '',
				away_logo: undefined,
				score: '',
				date: roundDate,
			}

			Array.from(row).forEach((child) => {
				const img = child.querySelector('img')
				const imgUrl = img
					?.getAttribute('src')
					?.replace('mini', 'large')
					?.substring(1)
				const className = child.getAttribute('class')?.split(' ').at(-1)

				if (className === 'home' || className === 'away') {
					const teamId =
						child.querySelector('a')?.getAttribute('href')?.split('/').at(-1) ??
						''
					const teamName = sanitizeTeamName(child.textContent ?? '').trim()
					const teamLogo = imgUrl ?? ''

					if (className === 'home') {
						game.home_id = teamId
						game.home = teamName
						game.home_logo = teamLogo
					} else {
						game.away_id = teamId
						game.away = teamName
						game.away_logo = teamLogo
					}
				} else if (className === 'score') {
					game.score = child.textContent?.trim() ?? ''
				}
			})
			game.time = !game.score ? time : undefined
			games.push(game)
		})
	} catch (e) {
		console.error('getData error:', e)
	}

	return games
}

const syncRoundTable = async (
	supabase: ReturnType<typeof createClient>,
	table: 'current_round' | 'next_round',
	games: RoundData,
) => {
	if (!games.length) {
		await supabase.from(table).delete().gt('game_id', 0)
		return { data: [] as RoundData, error: null }
	}

	const ids = games.map((game) => game.game_id)
	await supabase.from(table).delete().not('game_id', 'in', `(${ids.join(',')})`)

	return await supabase
		.from(table)
		.upsert(games, { onConflict: 'game_id' })
		.select()
}

Deno.serve(async () => {
	const games = await getCurrentRound()
	if (!games.length) {
		return new Response(
			JSON.stringify({
				error: 'Failed to scrape current round games',
			}),
			{
				status: 502,
				headers,
			},
		)
	}

	const nextGames = await getCurrentRound(games[0].round + 1, {
		preferOnOrAfter: new Date(games[0].date),
	})

	const supabase = createClient(
		Deno.env.get('SUPABASE_URL') ?? '',
		Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
	)

	const current_round = await syncRoundTable(supabase, 'current_round', games)
	const next_round = await syncRoundTable(supabase, 'next_round', nextGames)

	const error = current_round?.error ?? next_round?.error

	if (error) {
		return new Response(
			JSON.stringify({
				error: error.message,
			}),
			{
				status: 500,
				headers,
			},
		)
	}
	return new Response(
		JSON.stringify({
			inserted: {
				current: current_round?.data?.length ?? 0,
				next: next_round?.data?.length ?? 0,
			},
		}),
		{
			headers,
		},
	)
})

const headers = {
	'Content-Type': 'application/json',
}
