import 'dotenv/config';
import type { User } from 'grammy/types';
export declare const supabase: import("@supabase/supabase-js").SupabaseClient<any, "public", "public", any, any>;
export declare function getLeaderboard(): Promise<LeaderboardRow[]>;
export declare function getUserById(userId: number): Promise<LeaderboardRow | null>;
export declare function updateScore(userId: string, delta: number): Promise<LeaderboardRow>;
export declare function createPrediction(tgUser: User, gameId: number, homeTeam: string, awayTeam: string, homeGoals: number, awayGoals: number, round: number): Promise<PredictionRow>;
export declare function getPredictionsByUser(userId: number, round: number): Promise<PredictionRow[]>;
export declare function getAllPredictions(): Promise<PredictionRow[]>;
export type LeaderboardRow = {
    id: string;
    username: string;
    points: number;
    created_on: string;
};
export type PredictionRow = {
    id: string;
    user_id: string;
    home_team: string;
    away_team: string;
    home_goals: number;
    away_goals: number;
    created_on: string;
    game_id: number;
    round: number;
};
//# sourceMappingURL=supabase-client.d.ts.map