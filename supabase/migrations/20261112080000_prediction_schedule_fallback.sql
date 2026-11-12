create or replace function public.tg_lock_prediction_changes()
returns trigger
language plpgsql
as $function$
declare
  game_day_ts timestamptz;
  lock_ts timestamptz;
  game_season text;
  game_round integer;
  game_home_goals integer;
  game_away_goals integer;
  game_suspended boolean;
  active_season text;
  active_round integer;
begin
  -- Non-score updates are allowed, but manual scoring field tampering is blocked.
  if tg_op = 'UPDATE'
     and new.game_id is not distinct from old.game_id
     and new.round is not distinct from old.round
     and new.season is not distinct from old.season
     and new.home_goals is not distinct from old.home_goals
     and new.away_goals is not distinct from old.away_goals then

    if pg_trigger_depth() = 1 and (
      new.awarded is distinct from old.awarded
      or new.status is distinct from old.status
      or new.game_result is distinct from old.game_result
    ) then
      raise exception 'Manual updates of awarded/status/game_result are not allowed';
    end if;

    return new;
  end if;

  -- Once result is published, prediction score edits are always frozen.
  if tg_op = 'UPDATE' and old.game_result is not null and (
    new.home_goals is distinct from old.home_goals
    or new.away_goals is distinct from old.away_goals
  ) then
    raise exception 'Prediction is locked: result already published';
  end if;

  -- Block direct insert with precomputed award fields.
  if tg_op = 'INSERT' and (
    coalesce(new.awarded, false) = true
    or new.status is not null
    or new.game_result is not null
  ) then
    raise exception 'Manual insert with awarded/status/game_result is not allowed';
  end if;

  -- Use dated current/next snapshots when present.
  select r.date::timestamptz
    into game_day_ts
  from (
    select game_id, season, date from public.current_round
    union all
    select game_id, season, date from public.next_round
  ) r
  where r.game_id = new.game_id
    and (new.season is null or r.season = new.season or r.season is null)
  order by 1 asc
  limit 1;

  if game_day_ts is null then
    -- games is authoritative when the scraped snapshots do not contain a fixture.
    select g.season, g.round, g.home_goals, g.away_goals, g.suspended
      into game_season, game_round, game_home_goals, game_away_goals, game_suspended
    from public.games g
    where g.game_id = new.game_id
      and (new.season is null or g.season = new.season or g.season is null)
    limit 1;

    if not found then
      raise exception 'Predictions are closed (game schedule not found)';
    end if;

    if coalesce(game_suspended, false)
       or game_home_goals is not null
       or game_away_goals is not null then
      raise exception 'Predictions are closed for this game';
    end if;

    select g.season
      into active_season
    from public.games g
    where g.season is not null
    order by g.game_id desc
    limit 1;

    select min(g.round)
      into active_round
    from public.games g
    where g.season = active_season
      and (g.home_goals is null or g.away_goals is null)
      and not g.suspended;

    if game_season is distinct from active_season
       or game_round is distinct from active_round then
      raise exception 'Predictions are closed for this game';
    end if;

    -- No kickoff date is stored in games.time, so keep the active round open
    -- until results arrive or the fixture is marked suspended.
    return new;
  end if;

  -- Policy: lock at 03:00 matchday.
  lock_ts := date_trunc('day', game_day_ts) + interval '3 hours';

  if now() >= lock_ts then
    raise exception 'Predictions are closed for this game';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_predictions_lock on public.predictions;
create trigger trg_predictions_lock
before insert or update of game_id, round, season, home_goals, away_goals, awarded, status, game_result
on public.predictions
for each row execute function public.tg_lock_prediction_changes();
