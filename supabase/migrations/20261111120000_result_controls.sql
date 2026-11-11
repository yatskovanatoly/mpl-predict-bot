alter table public.games
	add column if not exists suspended boolean not null default false;

create or replace function public.reset_game_result(
	p_game_id bigint,
	p_updated_by bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
	if not exists (select 1 from public.games where game_id = p_game_id) then
		raise exception 'Game % not found', p_game_id using errcode = 'P0002';
	end if;

	update public.match_results
	set home_goals = null,
		away_goals = null,
		note = null,
		updated_by = p_updated_by,
		updated_at = now()
	where game_id = p_game_id;

	update public.games
	set home_goals = null,
		away_goals = null
	where game_id = p_game_id;

	update public.predictions
	set game_result = null,
		status = null,
		awarded = false,
		notified_at = null
	where game_id = p_game_id;
end;
$$;

revoke all on function public.reset_game_result(bigint, bigint) from public;
grant execute on function public.reset_game_result(bigint, bigint) to service_role;
