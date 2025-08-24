export function sanitizeScore(str: string): string {
	return str
		.trim()
		.replace(/[- ,]+/g, '-') // replace -, space, or , with single dash
		.replace(/^-|-$/g, '') // remove leading/trailing dash if any
}
