import { webhookCallback } from 'npm:grammy@^1.38.3'
import { bot } from '../_shared/telegram-bot/bot/index.ts'

const handleUpdate = webhookCallback(bot, 'std/http')

Deno.serve(async (req) => {
	try {
		const url = new URL(req.url)
		if (url.searchParams.get('secret') !== bot.token) {
			return new Response('not allowed', { status: 405 })
		}
		return await handleUpdate(req)
	} catch (err) {
		console.error(err)
	}
	return new Response()
})
