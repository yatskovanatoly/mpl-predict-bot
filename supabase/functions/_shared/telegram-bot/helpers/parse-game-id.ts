export const parseGameId = (id: string): number =>
	Number(id.split('_').at(-1))
