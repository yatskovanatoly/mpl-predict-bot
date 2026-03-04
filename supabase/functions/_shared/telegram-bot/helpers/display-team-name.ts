const TEAM_NAME_MAP: Record<string, string> = {
	'тасманские дьяволы': '👹 Тасманские Дьяволы',
	петруч: '👚 Петруч',
	балдеж: '🦥 Балдёж',
	'king is dead': '🤴🏻 King is Dead',
	клещи: '🕷️ Клещи',
	'старые дрожжи': '🌾 Старые Дрожжи',
	'черные но синие': '🍆 Чёрные но Синие',
	ракета: '🚀 Ракета',
	'душевой флирт': '🚿 Душевой Флирт',
	'bedros pilibos': '🇷🇴 Bedros Pilibos',
	щит: '💩 Щит',
	beamish: '☘️ Beamish',
	други: '🥛  Други',
	'вечер пятницы': '🌆 Вечер Пятницы',
}

const normalizeTeamName = (value: string) =>
	value
		.toLowerCase()
		.replace(/ё/g, 'е')
		.replace(/[«»"']/g, '')
		.replace(/\s+/g, ' ')
		.trim()

export const displayTeamName = (name: string) =>
	TEAM_NAME_MAP[normalizeTeamName(name)] ?? name
