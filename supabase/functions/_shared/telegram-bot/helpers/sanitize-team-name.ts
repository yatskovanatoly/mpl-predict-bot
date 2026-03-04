const TEAM_NAME_MAP: Record<string, string> = {
	'тасманские дьяволы': '👹 тасманские дьяволы',
	петруч: '👚 петруч',
	балдеж: '🦥 балдёж',
	'king is dead': '🤴🏻 king is dead',
	клещи: '🕷️ клещи',
	'старые дрожжи': '🌾 старые дрожжи',
	'черные но синие': '🍆 чёрные но синие',
	ракета: '🚀 ракета',
	'душевой флирт': '🚿 душевой флирт',
	'bedros pilibos': '🇧🇬 bedros pilibos',
	щит: '💩 щит',
	beamish: '☘️ бимиш',
	други: '🥛 други',
	'вечер пятницы': '🌆 вечер пятницы',
}

const normalizeTeamName = (value: string) =>
	value
		.toLowerCase()
		.replace(/ё/g, 'е')
		.replace(/[«»"']/g, '')
		.replace(/\s+/g, ' ')
		.trim()

export const sanitizeTeamName = (name: string) => {
	const cleaned = name
		.replace(/\b(ФК|ЛФК|ПФК|FC|AFC)\b/gi, '')
		.replace(/\s+/g, ' ')
		.trim()

	const mapped = TEAM_NAME_MAP[normalizeTeamName(cleaned)]
	return mapped ?? cleaned
}
