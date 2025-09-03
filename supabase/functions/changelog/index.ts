import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req) => {
	try {
		const supabase = createClient(
			Deno.env.get('SUPABASE_URL')!,
			Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
		)

		const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
		if (!TELEGRAM_BOT_TOKEN) {
			return new Response('Missing TELEGRAM_BOT_TOKEN env var', { status: 500 })
		}

		const { message, disable_notification } = await req.json()

		if (!message) {
			return new Response('Message is required', { status: 400 })
		}

		// Get all users
		const { data: users, error } = await supabase
			.from('leaderboard')
			.select('id')

		if (error) {
			return new Response(JSON.stringify({ error: error.message }), {
				status: 500,
			})
		}

		// Send message to each user
		for (const user of users) {
			await fetch(
				`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						chat_id: user.id,
						text: message,
            disable_notification
					}),
				}
			)
		}

		return new Response(
			JSON.stringify({
				success: true,
				sent: users.length,
			}),
			{ headers: { 'Content-Type': 'application/json' } }
		)
	} catch (err) {
		return new Response(JSON.stringify({ error: String(err) }), {
			status: 500,
		})
	}
})
