import { Document, DOMParser } from 'jsr:@b-fuze/deno-dom'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { parse } from 'npm:date-fns'
import { ru } from 'npm:date-fns/locale'
import { sanitizeTeamName } from '../_shared/telegram-bot/helpers/sanitize-team-name.ts'
import { Game, RoundData } from '../_shared/telegram-bot/lib/types.ts'
import { BASE_URL, MPL_ID } from '../_shared/telegram-bot/lib/urls.ts'

const getDocument = async (): Promise<Document> => {
	const response = await fetch(
		`https://${BASE_URL}/championships/${MPL_ID}/games`
	)
	const html = await response.text()
	const doc = new DOMParser().parseFromString(html, 'text/html')
	if (!doc) throw new Error('Failed to parse HTML')
	return doc
}

const getCurrentRound = async (): Promise<RoundData> => {
	const games: Game[] = []
	const doc = await getDocument()

	const date = doc.querySelector('.category2')?.textContent.trim() ?? ''
	const round = Number(doc.querySelector('.current')?.textContent ?? '0')
	const parsedRoundDate = parse(date, 'd MMMM, EEEE', new Date(), {
		locale: ru,
	})

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
				date: parsedRoundDate,
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
				game.time = !game.score ? time : undefined
			})
			games.push(game)
		})
	} catch (e) {
		console.error('getData error:', e)
	}

	return games
}

Deno.serve(async () => {
	const games = await getCurrentRound()

	const supabase = createClient(
		Deno.env.get('SUPABASE_URL') ?? '',
		Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
	)

	const { data, error } = await supabase
		.from('current_round')
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
