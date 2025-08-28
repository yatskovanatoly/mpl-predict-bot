const ru = `start = чем займёмся?
menu = ⬅️ меню
predict = ⚽ сделать прогноз
prev = 📋 результаты {$n}-го тура
predicted = твои прогнозы на {$n}-й тур:
leaderboard = 📊 таблица лидеров
match_select = выбери матч:
match = какой счёт будет в матче
leaderboard_view = 📊 таблица лидеров:
points = {
  $pts ->
    [one] {$pts} очко 
    [few] {$pts} очка 
    *[many] {$pts} очков
    }
prediction_made = ✅ прогноз сделан\\! {$n}*{$home}* – *{$away}* → {$homeGoals}:{$awayGoals}
prediction_fail = ❌ не удалось сделать прогноз. Ошибка: <blockquote expandable><code>{$err}</code></blockquote>
leaderboard_empty = здесь пока никого нет
leaderboard_fail = ❌ не удалось загрузить таблицу
error_score = некорректный формат счёта
no_upcoming_games = похоже, что сейчас банное межсезонье. попробуй снова ближе к возобновлению игр
prediction_closed = в день тура прогнозы закрыты

fallback = отправьте /start чтобы начать`

export default ru
