export const sanitizeTeamName = (name: string) =>
	name
		.replace(/\b(ФК|ЛФК|ПФК|FC|AFC)\b/gi, '')
		.replace(/\s+/g, ' ')
		.trim()
