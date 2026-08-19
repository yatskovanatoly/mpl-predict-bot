const ru = `start = чем займёмся?
menu = ⬅️ меню
predict = ⚽ сделать прогноз
predict_my = ⚽ мои прогнозы
prev = 📋 результаты {$n}-го тура
predicted = твои прогнозы на {$n}-й тур:
leaderboard = 📊 таблица лидеров
my_rounds = 🗂 история прогнозов
upcoming_percentages = 📈 предстоящий тур
choose_round = выбери тур:
no_rounds_with_predictions = пока нет туров с прогнозами
no_predictions_for_round = прогнозы за этот тур не найдены
round_predictions = 📋 прогнозы на {$n}-й тур
upcoming_percentages_title = 📈 {$n}-й тур: распределение прогнозов
no_upcoming_predictions = пока нет прогнозов на ближайший тур
percentages_legend = П1 — победа хозяев, X — ничья, П2 — победа гостей
match_select = выбери матч:
match = какой счёт будет в матче
leaderboard_view = 📊 таблица лидеров:
leaderboard_season_view = 📊 таблица лидеров · сезон {$season}
leaderboard_archive_view = 🏆 итоги сезона {$season}
leaderboard_archive = 🏆 архив сезонов
leaderboard_current = 📊 текущий сезон
leaderboard_archive_choose = 🏆 выбери сезон:
leaderboard_archive_empty = в архиве пока нет завершённых сезонов
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
prediction_closed = в день тура добавление прогнозов закрывается
no_predictions_made = увы, ты не делал прогнозов на этот тур. \n здесь будет появлятся счёт матчей по мере добавления на mychamp
all_predictions_made = ты сделал все прогнозы на этот тур
score = 🎯 угадан точный счёт
difference = ⚖️ угадана разница в счёте
winner = 🎲 угадан победитель матча
edit_prediction = ✏️ изменить прогноз
choose_edit_match = ✏️ выбери прогноз, который хочешь изменить:
forward = →
back = ←

fallback = отправь /start чтобы начать`

export default ru
