import { Bot, webhookCallback } from 'grammy'
import type { MyContext } from '../src/bot'

const token = process.env.TELEGRAM_BOT_TOKEN
if (!token) throw new Error('TELEGRAM_BOT_TOKEN is missing')

export const bot = new Bot<MyContext>(token)

export default webhookCallback(bot, 'https')
