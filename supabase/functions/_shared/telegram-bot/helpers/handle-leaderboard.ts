import { MyContext } from '../bot/index.ts'
import {
	getArchivedSeasons,
	getLeaderboardGrouped,
} from '../lib/supabase-client.ts'
import { buildLeaderboard, buildLeaderboardTitle } from './build-leaderboard.ts'
import {
	buildLeaderboardMenu,
	buildMenuButton,
	buildSeasonsMenu,
} from './build-menus.ts'
import { editHelper } from './edit-helper.ts'

export const LEADERBOARD_SEASON_PREFIX = 'leaderboard_season_'

export const handleLeaderboard = async (
	ctx: MyContext,
	data: string,
	currentSeason?: string | null
) => {
	if (!ctx.session.leaderboard)
		ctx.session.leaderboard = { page: 1, total_pages: 1 }

	try {
		if (data === 'leaderboard_archive') {
			await ctx.answerCallbackQuery()
			const seasons = (await getArchivedSeasons()).filter(
				(season) => season !== currentSeason
			)

			if (!seasons.length) {
				return await editHelper(
					() =>
						ctx.editMessageText(ctx.t('leaderboard_archive_empty'), {
							reply_markup: buildMenuButton(ctx),
						}),
					ctx
				)
			}

			return await editHelper(
				() =>
					ctx.editMessageText(ctx.t('leaderboard_archive_choose'), {
						reply_markup: buildSeasonsMenu(
							ctx,
							seasons,
							LEADERBOARD_SEASON_PREFIX
						),
					}),
				ctx
			)
		}

		let { page, total_pages, season } = ctx.session.leaderboard

		if (data === 'leaderboard' || data === 'leaderboard_current') {
			season = currentSeason ?? null
			page = 1
		} else if (data.startsWith(LEADERBOARD_SEASON_PREFIX)) {
			season = data.slice(LEADERBOARD_SEASON_PREFIX.length)
			page = 1
		} else if (data === 'leaderboard_next') {
			page = page < total_pages ? page + 1 : 1
		} else if (data === 'leaderboard_previous') {
			page = page > 1 ? page - 1 : total_pages
		} else if (data === 'leaderboard_first_page') {
			page = 1
		}

		await ctx.answerCallbackQuery()

		const leaderboardGrouped = await getLeaderboardGrouped(page, season)
		const resolvedSeason = leaderboardGrouped.season ?? season ?? null
		const isArchive =
			!!resolvedSeason && !!currentSeason && resolvedSeason !== currentSeason

		ctx.session.leaderboard = {
			page: leaderboardGrouped.page,
			total_pages: leaderboardGrouped.total_pages,
			season: resolvedSeason,
		}

		if (!Object.entries(leaderboardGrouped.data ?? {}).length) {
			ctx.session.leaderboard.page = 1
			const title = buildLeaderboardTitle(ctx, resolvedSeason, isArchive)
			return await editHelper(
				() =>
					ctx.editMessageText(`${title}\n\n${ctx.t('leaderboard_empty')}`, {
						reply_markup: buildLeaderboardMenu(ctx, null, isArchive),
					}),
				ctx
			)
		}

		const table = buildLeaderboard(
			leaderboardGrouped.data,
			ctx,
			resolvedSeason,
			isArchive
		)

		await editHelper(
			() =>
				ctx.editMessageText(table, {
					reply_markup: buildLeaderboardMenu(
						ctx,
						leaderboardGrouped,
						isArchive
					),
				}),
			ctx
		)
	} catch (err) {
		console.error(err)
		await ctx.reply(ctx.t('leaderboard_fail'), {
			reply_markup: buildMenuButton(ctx),
		})
	}
}
