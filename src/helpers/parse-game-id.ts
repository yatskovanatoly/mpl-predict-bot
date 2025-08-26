export const parseGameId = (id: string): number =>
	Number(id.replace('game_', ''))
