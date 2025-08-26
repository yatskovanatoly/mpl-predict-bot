import { parse } from 'npm:date-fns'
import { ru } from 'npm:date-fns/locale'
import { sanitizeTeamName } from '../helpers/sanitize-team-name.ts'
import type { Game, RoundData, Rounds } from './types.ts'
import { BASE_URL, MPL_ID } from './urls.ts'
import { Document, DOMParser } from 'jsr:@b-fuze/deno-dom'

const getDocument = async (round?: number): Promise<Document> => {
	const response = await fetch(
		`https://${BASE_URL}/championships/${MPL_ID}/games` +
			(round ? `?round=${round.toString()}` : ''),
		{
			headers: {
				'Cache-Control': 'no-cache',
				Pragma: 'no-cache',
				Expires: '0',
			},
		}
	)
	const html = await response.text()
	const doc = new DOMParser().parseFromString(html, 'text/html')
	if (!doc) throw new Error('Failed to parse HTML')
	return doc
}

const getData = async (roundN?: number): Promise<RoundData> => {
	const games: Game[] = []
	const doc = await getDocument(roundN)

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
			const id = Number(idAttr.replace('game_', ''))
			const time = parent.querySelector('.date')?.textContent.trim() ?? ''

			const game: Game = {
				id,
				round,
				home: { id: '', team: '', logo: undefined },
				away: { id: '', team: '', logo: undefined },
				score: '',
				game_id: 0,
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
					const id =
						child.querySelector('a')?.getAttribute('href')?.split('/').at(-1) ??
						''
					game[className] = {
						id,
						team: sanitizeTeamName(child.textContent ?? '').trim(),
						logo: imgUrl ?? '',
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

	return { date: parsedRoundDate, games, round }
}

export const getRounds = async (round?: number): Promise<Rounds> => {
	const rounds: string[] = []
	let currentRound: string | undefined
	const doc = await getDocument(round)

	try {
		doc
			.querySelectorAll('.ruler_selector a, .ruler_selector .current')
			.forEach((el) => {
				rounds.push(el.textContent?.trim() ?? '')
			})
		const current = doc.querySelector('.ruler_selector .current')
		if (current) {
			currentRound = current.textContent?.trim()
		}
	} catch (e) {
		console.error('getRounds error:', e)
	}
	return { rounds, currentRound }
}

export default getData
