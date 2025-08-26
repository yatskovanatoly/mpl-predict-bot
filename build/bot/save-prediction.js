import { createPrediction } from '../lib/supabase-client.js';
export async function saveUserPrediction(gameId, ctx, home, away, score, round) {
    const [homeGoalsStr, awayGoalsStr] = score.split('-');
    const homeGoals = parseInt(homeGoalsStr, 10);
    const awayGoals = parseInt(awayGoalsStr, 10);
    if (isNaN(homeGoals) || isNaN(awayGoals)) {
        throw new Error(ctx.t('error_score'));
    }
    return await createPrediction(ctx.from, gameId, home, away, homeGoals, awayGoals, round);
}
//# sourceMappingURL=save-prediction.js.map