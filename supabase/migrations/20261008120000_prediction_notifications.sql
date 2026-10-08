-- Уведомления об угаданных прогнозах.
--
-- notified_at — когда пользователю ушло сообщение о сыгравшем прогнозе.
-- Рассылку делает notifyPredictionResults() из edge-функций после синка игр.

alter table public.predictions
	add column if not exists notified_at timestamptz;

-- Уже начисленные прогнозы помечаем отправленными, иначе первый же запуск
-- разошлёт сообщения по всей истории.
update public.predictions
set notified_at = now()
where status is not null
	and notified_at is null;

create index if not exists predictions_pending_notification_idx
	on public.predictions (id)
	where status is not null and notified_at is null;
