import { MyContext } from '../bot/index.ts'
import { getLeaderboardGrouped } from '../lib/supabase-client.ts'
import { buildLeaderboard } from './build-leaderboard.ts'
import { buildLeaderboardMenu, buildMenuButton } from './build-menus.ts'
import { editHelper } from './edit-helper.ts'

export const handleLeaderboard = async (ctx: MyContext, data: string) => {
	if (!ctx.session.leaderboard)
		ctx.session.leaderboard = { page: 1, total_pages: 1 }

	try {
		let { page, total_pages } = ctx.session.leaderboard
		if (data === 'leaderboard_next') {
			page = page < total_pages ? page + 1 : 1
		} else if (data === 'leaderboard_previous') {
			page = page > 1 ? page - 1 : total_pages
		} else if (data === 'leaderboard_first_page') {
			page = 1
		}

		const leaderboardGrouped = await getLeaderboardGrouped(page)

		ctx.session.leaderboard.page = leaderboardGrouped.page
		ctx.session.leaderboard.total_pages = leaderboardGrouped.total_pages

		if (!Object.entries(leaderboardGrouped.data).length) {
			await ctx.editMessageText(ctx.t('leaderboard_empty'), {
				reply_markup: buildMenuButton(ctx),
			})
			ctx.session.leaderboard.page = 1
			return
		}

		const table = buildLeaderboard(leaderboardGrouped.data, ctx)

		await editHelper(
			() =>
				ctx.editMessageText(table, {
					reply_markup: buildLeaderboardMenu(ctx, leaderboardGrouped),
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
