import axios from 'axios'
import * as cheerio from 'cheerio'
import { sanitizeTeamName } from '../src/helpers/sanitize-team-name.js'
import type { Game, RoundData, Rounds } from './types.js'
import { BASE_URL, MPL_ID } from './urls.js'
import { parse } from 'date-fns'
import { ru } from 'date-fns/locale'

const getCheerio = async (round?: number): Promise<cheerio.CheerioAPI> => {
	const response = await axios.get(
		`https://${BASE_URL}/championships/${MPL_ID}/games` +
			`${round ? `?round=${round.toString()}` : ''}`,
		{
			headers: {
				'Cache-Control': 'no-cache',
				Pragma: 'no-cache',
				Expires: '0',
			},
		}
	)
	const $ = cheerio.load(response.data)

	return $
}

const getData = async (roundN?: number): Promise<RoundData> => {
	const games: Game[] = []
	const $ = await getCheerio(roundN)
	const date = $('.category2').text().trim() || ''
	const round = Number($('.current').text())
	const parsedRoundDate = parse(date, 'd MMMM, EEEE', new Date(), {
		locale: ru,
	})

	try {
		$('.result').each((i, el) => {
			const row = $(el).find('.row').children()
			const id = Number($(el).parent().attr('id')!.replace('game_', ''))
			const time = $(el).parent().find('.date').text().trim()

			const game: Game = {
				id,
				round,
				home: {
					id: '',
					team: '',
					logo: undefined,
				},
				away: {
					id: '',
					team: '',
					logo: undefined,
				},
				score: '',
				game_id: 0,
				date: parsedRoundDate,
			}

			row.each((_, child) => {
				const $child = $(child)
				const img = $child.find('img')
				const imgUrl = img?.attr()?.src?.replace('mini', 'large').substring(1)
				const className = $child.attr('class')?.split(' ').at(-1)

				if (className === 'home' || className === 'away') {
					const id = $child?.find('a')?.attr()!.href?.split('/').at(-1)!

					game[className as 'home' | 'away'] = {
						id,
						team: sanitizeTeamName($child.text()).trim(),
						logo: imgUrl ?? '',
					}
				} else if (className === 'score') {
					game.score = $child.text().trim()
				}
				game.time = !game.score ? time : undefined
			})
			games.push(game)
		})
	} catch (e) {
		console.error(e)
	}
	return { date: parsedRoundDate, games, round }
}

export const getRounds = async (round?: number): Promise<Rounds> => {
	const rounds: string[] = []
	let currentRound
	const $ = await getCheerio(round)

	try {
		$('.ruler_selector a, .ruler_selector .current').each((i, el) => {
			rounds.push($(el).text().trim())
		})
		$('.ruler_selector .current').each((i, el) => {
			currentRound = $(el).text().trim()
		})
	} catch (e) {
		console.error(e)
	}
	return { rounds, currentRound }
}

export default getData
