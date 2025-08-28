export function sanitizeScore(str: string): string {
	return str
		.trim()
		.replace(/[- ,]+/, '-') // replace -, space, or , with single dash
		.replace(/^-|-$/g, '') // remove leading/trailing dash if any
		.replace(/[^\d-]/g, '') // remove non-digits
}
