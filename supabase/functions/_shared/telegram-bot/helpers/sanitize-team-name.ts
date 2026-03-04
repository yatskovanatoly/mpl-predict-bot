export const sanitizeTeamName = (name: string) =>
	name
		.replace(/\b(?:ФК|ЛФК|ПФК|FC|AFC)\.?\b/gi, '')
		.replace(/[«»"'`]/g, '')
		.replace(/^\s*[-–—]+\s*/g, '')
		.replace(/\s+/g, ' ')
		.trim()
