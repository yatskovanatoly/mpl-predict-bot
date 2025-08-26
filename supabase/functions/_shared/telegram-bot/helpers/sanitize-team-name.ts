export const sanitizeTeamName = (name: string) =>
	name.replace(/(ФК|ЛФК|ПФК|FC|AFC)/gi, '')
