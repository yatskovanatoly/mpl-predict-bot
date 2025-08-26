"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userPredictionIteratee = void 0;
var userPredictionIteratee = function (_a) {
    var home_team = _a.home_team, away_team = _a.away_team, home_goals = _a.home_goals, away_goals = _a.away_goals;
    return "".concat(home_team, " \u2013 ").concat(away_team, " \u2192 ").concat(home_goals, ":").concat(away_goals);
};
exports.userPredictionIteratee = userPredictionIteratee;
