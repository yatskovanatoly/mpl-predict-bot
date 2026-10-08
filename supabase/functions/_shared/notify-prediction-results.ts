import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { displayTeamName } from './telegram-bot/helpers/display-team-name.ts'

type Status = 'score' | 'difference' | 'winner'

type ScoredPrediction = {
	id: string
	user_id: number | null
	home_team: string | null
	away_team: string | null
	home_goals: number | null
	away_goals: number | null
	game_result: string | null
	status: Status | null
}

const STATUS_LABELS: Record<Status, string> = {
	score: '🎯 угадан точный счёт',
	difference: '⚖️ угадана разница в счёте',
	winner: '🎲 угадан победитель матча',
}

export const formatPredictionResult = ({
	home_team,
	away_team,
	home_goals,
	away_goals,
	game_result,
	status,
}: ScoredPrediction) => {
	if (!status) return ''
	const match = `${displayTeamName(home_team ?? '')} ${game_result} ${displayTeamName(away_team ?? '')}`
	const prediction =
		status !== 'score' ? ` (прогноз ${home_goals}:${away_goals})` : ''
	return `${STATUS_LABELS[status]} – ${match}${prediction}`
}

async function sendTelegramMessage(
	token: string,
	chatId: number,
	text: string,
): Promise<number> {
	const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ chat_id: chatId, text }),
	})
	if (!res.ok) {
		console.warn('sendMessage failed:', chatId, res.status, await res.text())
	}
	return res.status
}

// Шлёт пользователям сообщения об угаданных прогнозах. Статус прогнозу ставит
// триггер в БД при появлении счёта, поэтому вызывать после синка игр.
export async function notifyPredictionResults(
	// deno-lint-ignore no-explicit-any
	supabase: SupabaseClient<any>,
): Promise<{ sent: number; predictions: number }> {
	const token = Deno.env.get('TELEGRAM_BOT_TOKEN')
	if (!token) {
		console.warn('notifyPredictionResults: missing TELEGRAM_BOT_TOKEN')
		return { sent: 0, predictions: 0 }
	}

	// Забираем прогнозы одним update: параллельный вызов получит ноль строк
	// и не отправит то же сообщение второй раз.
	const { data, error } = await supabase
		.from('predictions')
		.update({ notified_at: new Date().toISOString() })
		.not('status', 'is', null)
		.not('game_result', 'is', null)
		.not('user_id', 'is', null)
		.is('notified_at', null)
		.select(
			'id,user_id,home_team,away_team,home_goals,away_goals,game_result,status',
		)

	if (error) {
		console.warn('notifyPredictionResults:', error.message)
		return { sent: 0, predictions: 0 }
	}

	const byUser = new Map<number, ScoredPrediction[]>()
	for (const prediction of (data ?? []) as ScoredPrediction[]) {
		if (typeof prediction.user_id !== 'number') continue
		const list = byUser.get(prediction.user_id) ?? []
		list.push(prediction)
		byUser.set(prediction.user_id, list)
	}

	let sent = 0
	for (const [userId, predictions] of byUser) {
		const text = predictions.map(formatPredictionResult).join('\n')
		const status = await sendTelegramMessage(token, userId, text)
		if (status === 200) {
			sent++
			continue
		}
		// 400/403 — бот заблокирован или чат не найден, повторять бессмысленно.
		if (status === 400 || status === 403) continue
		await supabase
			.from('predictions')
			.update({ notified_at: null })
			.in(
				'id',
				predictions.map((prediction) => prediction.id),
			)
	}

	return { sent, predictions: data?.length ?? 0 }
}
