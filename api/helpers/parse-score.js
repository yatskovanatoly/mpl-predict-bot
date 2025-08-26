"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeScore = sanitizeScore;
function sanitizeScore(str) {
    return str
        .trim()
        .replace(/[- ,]+/g, '-') // replace -, space, or , with single dash
        .replace(/^-|-$/g, ''); // remove leading/trailing dash if any
}
