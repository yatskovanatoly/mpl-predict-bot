import { getLeaderboardGrouped } from '../lib/supabase-client.ts'
import { buildLeaderboard } from './build-leaderboard.ts'
import { buildLeaderboardMenu, buildMenuButton } from './build-menus.ts'
import { editHelper } from './edit-helper.ts'

let leaderboardPage = 1
let totalPages = 0

export const handleLeaderboard = async (ctx: any, data: string) => {
	try {
		let page = leaderboardPage

		if (data === 'leaderboard') {
			page = leaderboardPage
		} else if (data === 'leaderboard_next') {
			page = leaderboardPage < totalPages ? leaderboardPage + 1 : 1
		} else if (data === 'leaderboard_previous') {
			page = leaderboardPage > 1 ? leaderboardPage - 1 : totalPages
		} else if (data === 'leaderboard_first_page') {
			page = 1
		}

		const leaderboardGrouped = await getLeaderboardGrouped(page)
		totalPages = leaderboardGrouped.total_pages
		console.log(leaderboardPage, totalPages, leaderboardGrouped)

		if (!Object.entries(leaderboardGrouped.data).length) {
			await ctx.editMessageText(ctx.t('leaderboard_empty'), {
				reply_markup: buildMenuButton(ctx),
			})
			leaderboardPage = 1
			return
		}

		leaderboardPage = leaderboardGrouped.page

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
