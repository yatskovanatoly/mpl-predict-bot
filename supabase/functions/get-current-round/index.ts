import { Document, DOMParser } from 'jsr:@b-fuze/deno-dom@0.1.56'
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { isValid } from 'npm:date-fns@^4.1.0/isValid'
import { parse } from 'npm:date-fns@^4.1.0'
import { ru } from 'npm:date-fns@^4.1.0/locale'
import { sanitizeTeamName } from '../_shared/telegram-bot/helpers/sanitize-team-name.ts'
import { Database } from '../_shared/telegram-bot/database.types.ts'
import { Game, RoundData } from '../_shared/telegram-bot/lib/types.ts'
import { BASE_URL, MPL_ID } from '../_shared/telegram-bot/lib/urls.ts'

const RU_MONTHS: Record<string, string> = {
	январь: '01',
	февраль: '02',
	март: '03',
	апрель: '04',
	май: '05',
	июнь: '06',
	июль: '07',
	август: '08',
	сентябрь: '09',
	октябрь: '10',
	ноябрь: '11',
	декабрь: '12',
}

const parseSeasonCode = (text: string) => {
	const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim()
	const match = normalized.match(
		/(январь|февраль|март|апрель|май|июнь|июль|август|сентябрь|октябрь|ноябрь|декабрь)\s+(\d{4})\s*[—-]\s*(январь|февраль|март|апрель|май|июнь|июль|август|сентябрь|октябрь|ноябрь|декабрь)\s+(\d{4})/,
	)
	if (!match) return null
	const startMonth = match[1]
	const startYear = match[2]
	const endMonth = match[3]
	const endYear = match[4]
	if (!startMonth || !startYear || !endMonth || !endYear) return null

	const startMonthNum = RU_MONTHS[startMonth]
	const endMonthNum = RU_MONTHS[endMonth]
	if (!startMonthNum || !endMonthNum) return null
	const start = `${startMonthNum}-${startYear}`
	const end = `${endMonthNum}-${endYear}`
	return `${start}, ${end}`
}

const getSeasonFromDocument = (doc: Document) => {
	const seasonText =
		doc.querySelector('.subheader a.link')?.textContent?.trim() ??
		doc.querySelector('.subheader')?.textContent?.trim() ??
		''
	return parseSeasonCode(seasonText)
}

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
			}),
		)
		.filter((date) => isValid(date))

	if (!candidates.length) return referenceDate

	const preferOnOrAfter = options?.preferOnOrAfter
	if (preferOnOrAfter) {
		const fromTs = preferOnOrAfter.getTime()
		const futureOrSame = candidates
			.filter((date) => date.getTime() >= fromTs)
			.sort((a, b) => a.getTime() - b.getTime())
		const firstFuture = futureOrSame.at(0)
		if (firstFuture) return firstFuture
	}

	const nearest = candidates
		.sort((a, b) => {
			const aDelta = Math.abs(a.getTime() - referenceDate.getTime())
			const bDelta = Math.abs(b.getTime() - referenceDate.getTime())
			return aDelta - bDelta
		})
		.at(0)
	return nearest ?? referenceDate
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
	const season = getSeasonFromDocument(doc)

	const date = doc.querySelector('.category2')?.textContent?.trim() ?? ''
	const roundText =
		doc.querySelector('.current')?.textContent?.trim() ??
		roundN?.toString() ??
		'0'
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
			const time = parent.querySelector('.date')?.textContent?.trim() ?? ''

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
				season: season ?? '',
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
	supabase: SupabaseClient<Database>,
	table: 'current_round' | 'next_round',
	games: RoundData,
) => {
	if (!games.length) {
		await supabase.from(table).delete().gt('game_id', 0)
		return { data: [] as RoundData, error: null }
	}

	const ids = games.map((game) => game.game_id)
	await supabase
		.from(table)
		.delete()
		.not('game_id', 'in', `(${ids.join(',')})`)

	type RoundInsert = Database['public']['Tables']['current_round']['Insert']
	const payload: RoundInsert[] = games.map((game) => ({
		...game,
		home_id: Number.isFinite(Number(game.home_id))
			? Number(game.home_id)
			: null,
		away_id: Number.isFinite(Number(game.away_id))
			? Number(game.away_id)
			: null,
		home_logo: game.home_logo ?? null,
		away_logo: game.away_logo ?? null,
		date: game.date.toISOString(),
		time: game.time ?? null,
		season: game.season || null,
	}))

	return await supabase
		.from(table)
		.upsert(payload, { onConflict: 'game_id' })
		.select()
}

const ensureSeason = async (
	supabase: SupabaseClient<Database>,
	seasonCode?: string,
) => {
	if (!seasonCode) return
	const { data: existing } = await supabase
		.from('seasons')
		.select('code')
		.eq('code', seasonCode)
		.limit(1)
		.maybeSingle()
	if (existing) return
	await supabase.from('seasons').insert({ code: seasonCode, label: seasonCode })
}

Deno.serve(async () => {
	const games = await getCurrentRound()
	const currentRoundFirst = games.at(0)
	if (!currentRoundFirst) {
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

	const nextGames = await getCurrentRound(currentRoundFirst.round + 1, {
		preferOnOrAfter: new Date(currentRoundFirst.date),
	})

	const supabase = createClient<Database>(
		Deno.env.get('SUPABASE_URL') ?? '',
		Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
	)
	await ensureSeason(supabase, currentRoundFirst.season)
	const nextRoundFirst = nextGames.at(0)
	if (nextRoundFirst?.season) {
		await ensureSeason(supabase, nextRoundFirst.season)
	}

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
