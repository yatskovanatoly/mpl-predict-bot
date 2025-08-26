import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
export const supabase = createClient(supabaseUrl, supabaseKey);
export async function getLeaderboard() {
    const { data, error } = await supabase
        .from('leaderboard')
        .select('*')
        .order('points', { ascending: false });
    if (error)
        throw error;
    return data;
}
export async function getUserById(userId) {
    const { data, error } = await supabase
        .from('leaderboard')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
    if (error)
        throw error;
    return data;
}
export async function updateScore(userId, delta) {
    const { data: user, error: fetchError } = await supabase
        .from('leaderboard')
        .select('score')
        .eq('id', userId)
        .single();
    if (fetchError)
        throw fetchError;
    const newScore = (user?.score ?? 0) + delta;
    const { data, error } = await supabase
        .from('leaderboard')
        .update({ score: newScore })
        .eq('id', userId)
        .select()
        .single();
    if (error)
        throw error;
    return data;
}
export async function createPrediction(tgUser, gameId, homeTeam, awayTeam, homeGoals, awayGoals, round) {
    const { data, error } = await supabase
        .from('predictions')
        .insert({
        user_id: tgUser.id,
        game_id: gameId,
        home_team: homeTeam,
        away_team: awayTeam,
        home_goals: homeGoals,
        away_goals: awayGoals,
        username: tgUser.username,
        round,
    })
        .select()
        .single();
    if (error) {
        console.log(error);
        throw error;
    }
    return data;
}
export async function getPredictionsByUser(userId, round) {
    const user = await getUserById(userId);
    if (!user)
        return [];
    const { data, error } = await supabase
        .from('predictions')
        .select('*')
        .eq('user_id', user.id)
        .eq('round', round)
        .order('created_at', { ascending: false });
    if (error)
        throw error;
    return data;
}
export async function getAllPredictions() {
    const { data, error } = await supabase
        .from('predictions')
        .select('*')
        .order('created_at', { ascending: false });
    if (error)
        throw error;
    return data;
}
//# sourceMappingURL=supabase-client.js.map