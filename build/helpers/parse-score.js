export function sanitizeScore(str) {
    return str
        .trim()
        .replace(/[- ,]+/g, '-') // replace -, space, or , with single dash
        .replace(/^-|-$/g, ''); // remove leading/trailing dash if any
}
//# sourceMappingURL=parse-score.js.map