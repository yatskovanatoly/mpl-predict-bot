// "08-2025, 06-2026" -> "2025/26"
export const formatSeason = (season?: string | null): string => {
	if (!season) return ''

	const match = season.match(/^(\d{2})-(\d{4})\s*,\s*(\d{2})-(\d{4})$/)
	if (!match) return season

	const [, , startYear, , endYear] = match
	return `${startYear}/${endYear.slice(2)}`
}
