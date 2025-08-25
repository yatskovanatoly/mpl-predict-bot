import type { MyContext } from '../bot/index.js'

export const editHelper = async (fn: () => Promise<any>, ctx: MyContext) => {
	try {
		await fn()
	} catch (err) {
		console.log(err)
		ctx.reply(JSON.stringify(err))
	}
}
