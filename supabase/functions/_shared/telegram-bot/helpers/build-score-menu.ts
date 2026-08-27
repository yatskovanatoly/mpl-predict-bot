import { InlineKeyboard } from 'npm:grammy@1.39.3'
import { MyContext } from '../bot/index.ts'
import { Game } from '../lib/types.ts'
import { displayTeamName } from './display-team-name.ts'

const MAX_GOALS = 20
const QUICK_GOALS = [0, 1, 2, 3, 4, 5]

export const clampGoals = (value: number) =>
	Number.isFinite(value)
		? Math.min(Math.max(Math.trunc(value), 0), MAX_GOALS)
		: 0

const scoreCallback = (gameId: number, home: number, away: number) =>
	`sc_${gameId}_${home}_${away}`

const buildTeamRow = (
	kb: InlineKeyboard,
	game: Game,
	side: 'home' | 'away',
	home: number,
	away: number
) => {
	const goals = side === 'home' ? home : away

	kb.text(`${displayTeamName(game[side])} · ${goals}`, 'noop').row()
}

const buildGoalsRow = (
	kb: InlineKeyboard,
	game: Game,
	side: 'home' | 'away',
	home: number,
	away: number
) => {
	const goals = side === 'home' ? home : away

	QUICK_GOALS.forEach((value) => {
		const [nextHome, nextAway] = side === 'home' ? [value, away] : [home, value]
		kb.text(
			goals === value ? `·${value}·` : `${value}`,
			scoreCallback(game.game_id, nextHome, nextAway)
		)
	})

	const next = clampGoals(goals + 1)
	const [plusHome, plusAway] = side === 'home' ? [next, away] : [home, next]
	kb.text('+', scoreCallback(game.game_id, plusHome, plusAway)).row()
}

export const buildScoreMenu = (
	ctx: MyContext,
	game: Game,
	home: number,
	away: number
) => {
	const kb = new InlineKeyboard()

	buildTeamRow(kb, game, 'home', home, away)
	buildGoalsRow(kb, game, 'home', home, away)
	buildTeamRow(kb, game, 'away', home, away)
	buildGoalsRow(kb, game, 'away', home, away)

	kb.text(
		`${ctx.t('score_save')} ${home}:${away}`,
		`scs_${game.game_id}_${home}_${away}`
	).row()
	kb.text(ctx.t('back_to_matches'), 'predict')

	return kb
}

export const buildScoreText = (
	ctx: MyContext,
	game: Game,
	home: number,
	away: number
) =>
	`${ctx.t('score_title')}\n\n${displayTeamName(game.home)} — ${displayTeamName(
		game.away
	)}\n\n${home} : ${away}`
