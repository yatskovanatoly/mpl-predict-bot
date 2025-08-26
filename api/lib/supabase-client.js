"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = void 0;
exports.getLeaderboard = getLeaderboard;
exports.getUserById = getUserById;
exports.updateScore = updateScore;
exports.createPrediction = createPrediction;
exports.getPredictionsByUser = getPredictionsByUser;
exports.getAllPredictions = getAllPredictions;
var supabase_js_1 = require("@supabase/supabase-js");
require("dotenv/config");
var supabaseUrl = process.env.SUPABASE_URL;
var supabaseKey = process.env.SUPABASE_ANON_KEY;
exports.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
function getLeaderboard() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, exports.supabase
                        .from('leaderboard')
                        .select('*')
                        .order('points', { ascending: false })];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw error;
                    return [2 /*return*/, data];
            }
        });
    });
}
function getUserById(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, exports.supabase
                        .from('leaderboard')
                        .select('*')
                        .eq('id', userId)
                        .maybeSingle()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw error;
                    return [2 /*return*/, data];
            }
        });
    });
}
function updateScore(userId, delta) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, user, fetchError, newScore, _b, data, error;
        var _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, exports.supabase
                        .from('leaderboard')
                        .select('score')
                        .eq('id', userId)
                        .single()];
                case 1:
                    _a = _d.sent(), user = _a.data, fetchError = _a.error;
                    if (fetchError)
                        throw fetchError;
                    newScore = ((_c = user === null || user === void 0 ? void 0 : user.score) !== null && _c !== void 0 ? _c : 0) + delta;
                    return [4 /*yield*/, exports.supabase
                            .from('leaderboard')
                            .update({ score: newScore })
                            .eq('id', userId)
                            .select()
                            .single()];
                case 2:
                    _b = _d.sent(), data = _b.data, error = _b.error;
                    if (error)
                        throw error;
                    return [2 /*return*/, data];
            }
        });
    });
}
function createPrediction(tgUser, gameId, homeTeam, awayTeam, homeGoals, awayGoals, round) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, exports.supabase
                        .from('predictions')
                        .insert({
                        user_id: tgUser.id,
                        game_id: gameId,
                        home_team: homeTeam,
                        away_team: awayTeam,
                        home_goals: homeGoals,
                        away_goals: awayGoals,
                        username: tgUser.username,
                        round: round,
                    })
                        .select()
                        .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error) {
                        console.log(error);
                        throw error;
                    }
                    return [2 /*return*/, data];
            }
        });
    });
}
function getPredictionsByUser(userId, round) {
    return __awaiter(this, void 0, void 0, function () {
        var user, _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, getUserById(userId)];
                case 1:
                    user = _b.sent();
                    if (!user)
                        return [2 /*return*/, []];
                    return [4 /*yield*/, exports.supabase
                            .from('predictions')
                            .select('*')
                            .eq('user_id', user.id)
                            .eq('round', round)
                            .order('created_at', { ascending: false })];
                case 2:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw error;
                    return [2 /*return*/, data];
            }
        });
    });
}
function getAllPredictions() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, exports.supabase
                        .from('predictions')
                        .select('*')
                        .order('created_at', { ascending: false })];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        throw error;
                    return [2 /*return*/, data];
            }
        });
    });
}
