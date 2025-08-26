import { bot } from '../src/bot'
import { webhookCallback } from 'grammy'

export default webhookCallback(bot, 'http')
