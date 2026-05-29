import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
	fetchCurrentRound,
	fetchNextRound,
	getGamesForDisplay,
	isFridayMsk,
	isMatchdayTomorrow,
} from '../_shared/matchday.ts'

const MESSAGE = 'а тур уже завтра...'

async function refreshRoundData(
	supabaseUrl: string,
	serviceRoleKey: string,
): Promise<void> {
	const res = await fetch(`${supabaseUrl}/functions/v1/get-current-round`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${serviceRoleKey}` },
	})
	if (!res.ok) {
		console.warn('get-current-round failed:', res.status, await res.text())
	}
}

async function sendTelegramMessage(
	token: string,
	chatId: number,
	text: string,
): Promise<boolean> {
	const res = await fetch(
		`https://api.telegram.org/bot${token}/sendMessage`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ chat_id: chatId, text }),
		},
	)
	if (!res.ok) {
		console.warn('sendMessage failed:', chatId, res.status, await res.text())
		return false
	}
	return true
}

Deno.serve(async () => {
	try {
		if (!isFridayMsk()) {
			return json({ skipped: true, reason: 'not_friday_msk' })
		}

		const supabaseUrl = Deno.env.get('SUPABASE_URL')
		const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
		const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN')

		if (!supabaseUrl || !serviceRoleKey) {
			return json({ error: 'Missing Supabase env vars' }, 500)
		}
		if (!telegramToken) {
			return json({ error: 'Missing TELEGRAM_BOT_TOKEN' }, 500)
		}

		await refreshRoundData(supabaseUrl, serviceRoleKey)

		const supabase = createClient(supabaseUrl, serviceRoleKey)
		const [currentGames, nextGames] = await Promise.all([
			fetchCurrentRound(supabase),
			fetchNextRound(supabase),
		])
		const displayGames = getGamesForDisplay(currentGames, nextGames)

		if (!isMatchdayTomorrow(displayGames)) {
			return json({
				skipped: true,
				reason: 'no_matchday_tomorrow',
				matchday: displayGames[0]?.date ?? null,
			})
		}

		const { data: users, error } = await supabase
			.from('leaderboard')
			.select('user_id')
			.gt('points', 0)
			.not('user_id', 'is', null)

		if (error) {
			return json({ error: error.message }, 500)
		}

		const chatIds = (users ?? [])
			.map((row) => row.user_id)
			.filter((id): id is number => typeof id === 'number')

		if (!chatIds.length) {
			return json({ skipped: true, reason: 'no_eligible_users' })
		}

		let sent = 0
		for (const chatId of chatIds) {
			if (await sendTelegramMessage(telegramToken, chatId, MESSAGE)) {
				sent++
			}
		}

		return json({
			success: true,
			sent,
			eligible: chatIds.length,
			matchday: displayGames[0]?.date ?? null,
		})
	} catch (err) {
		return json({ error: String(err) }, 500)
	}
})

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	})
}
