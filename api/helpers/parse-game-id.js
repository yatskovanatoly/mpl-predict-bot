"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseGameId = void 0;
var parseGameId = function (id) {
    return Number(id.replace('game_', ''));
};
exports.parseGameId = parseGameId;
