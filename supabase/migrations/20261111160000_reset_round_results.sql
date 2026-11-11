create or replace function public.reset_round_results(
	p_season text,
	p_round integer,
	p_updated_by bigint
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
	game_ids bigint[];
	game_count integer;
begin
	select array_agg(game_id), count(*)::integer
	into game_ids, game_count
	from public.games
	where coalesce(season, '') = coalesce(p_season, '')
		and round = p_round;

	if coalesce(game_count, 0) = 0 then
		raise exception 'Round % not found in season %', p_round, p_season using errcode = 'P0002';
	end if;

	update public.match_results
	set home_goals = null,
		away_goals = null,
		note = null,
		updated_by = p_updated_by,
		updated_at = now()
	where game_id = any(game_ids)
		and (home_goals is not null or away_goals is not null or note is not null);

	update public.games
	set home_goals = null,
		away_goals = null
	where game_id = any(game_ids)
		and (home_goals is not null or away_goals is not null);

	update public.predictions
	set game_result = null,
		status = null,
		awarded = false,
		notified_at = null
	where game_id = any(game_ids);

	return game_count;
end;
$$;

revoke all on function public.reset_round_results(text, integer, bigint) from public;
grant execute on function public.reset_round_results(text, integer, bigint) to service_role;
