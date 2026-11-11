create table if not exists public.match_results (
	game_id bigint primary key,
	season text not null default '',
	round integer not null,
	match_date timestamptz,
	time text,
	home_id text not null,
	home_name text not null,
	home_logo text,
	away_id text not null,
	away_name text not null,
	away_logo text,
	home_goals integer,
	away_goals integer,
	note text,
	updated_by bigint,
	updated_at timestamptz not null default now(),
	constraint match_results_goals_nonnegative check (
		home_goals is null or home_goals >= 0
	),
	constraint match_results_away_goals_nonnegative check (
		away_goals is null or away_goals >= 0
	),
	constraint match_results_score_pair check (
		(home_goals is null) = (away_goals is null)
	)
);

create table if not exists public.team_stats (
	season text not null,
	team_id text not null,
	team_name text not null,
	logo text,
	played integer not null default 0,
	wins integer not null default 0,
	draws integer not null default 0,
	losses integer not null default 0,
	goals_for integer not null default 0,
	goals_against integer not null default 0,
	goal_diff integer generated always as (goals_for - goals_against) stored,
	points integer generated always as (wins * 3 + draws) stored,
	updated_at timestamptz not null default now(),
	primary key (season, team_id)
);

create table if not exists public.admins (
	telegram_id bigint primary key,
	username text unique,
	created_at timestamptz not null default now()
);

insert into public.admins (telegram_id)
values (417628255), (144069997), (92505840)
on conflict (telegram_id) do nothing;

insert into public.match_results (
	game_id, season, round, time, home_id, home_name, home_logo,
	away_id, away_name, away_logo, home_goals, away_goals
)
select game_id, coalesce(season, ''), round, time, home_id, home_name, home_logo,
	away_id, away_name, away_logo, home_goals, away_goals
from public.games
on conflict (game_id) do nothing;

create or replace function public.refresh_team_stats(p_season text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
	delete from public.team_stats
	where p_season is null or season = p_season;

	insert into public.team_stats (
		season, team_id, team_name, logo, played, wins, draws, losses,
		goals_for, goals_against, updated_at
	)
	select season, team_id, max(team_name), max(logo), count(*)::integer,
		count(*) filter (where goals_for > goals_against)::integer,
		count(*) filter (where goals_for = goals_against)::integer,
		count(*) filter (where goals_for < goals_against)::integer,
		coalesce(sum(goals_for), 0)::integer,
		coalesce(sum(goals_against), 0)::integer,
		now()
	from (
		select season, home_id as team_id, home_name as team_name,
			home_logo as logo, home_goals as goals_for, away_goals as goals_against
		from public.match_results
		where home_goals is not null and (p_season is null or season = p_season)
		union all
		select season, away_id, away_name, away_logo, away_goals, home_goals
		from public.match_results
		where away_goals is not null and (p_season is null or season = p_season)
	) played_matches
	group by season, team_id;
end;
$$;

create or replace function public.refresh_team_stats_after_result()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
	if tg_op = 'DELETE' then
		perform public.refresh_team_stats(old.season);
		return old;
	end if;
	if tg_op = 'UPDATE' and old.season is distinct from new.season then
		perform public.refresh_team_stats(old.season);
	end if;
	if tg_op in ('INSERT', 'UPDATE') then
		perform public.refresh_team_stats(new.season);
	end if;
	return new;
end;
$$;

drop trigger if exists match_results_refresh_team_stats on public.match_results;
create trigger match_results_refresh_team_stats
after insert or update or delete on public.match_results
for each row execute function public.refresh_team_stats_after_result();

create or replace function public.sync_game_fixture_to_match_results()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
	insert into public.match_results (
		game_id, season, round, time, home_id, home_name, home_logo,
		away_id, away_name, away_logo, home_goals, away_goals
	) values (
		new.game_id, coalesce(new.season, ''), new.round, new.time,
		new.home_id, new.home_name, new.home_logo,
		new.away_id, new.away_name, new.away_logo,
		new.home_goals, new.away_goals
	)
	on conflict (game_id) do update set
		season = excluded.season,
		round = excluded.round,
		time = excluded.time,
		home_id = excluded.home_id,
		home_name = excluded.home_name,
		home_logo = excluded.home_logo,
		away_id = excluded.away_id,
		away_name = excluded.away_name,
		away_logo = excluded.away_logo,
		home_goals = coalesce(public.match_results.home_goals, excluded.home_goals),
		away_goals = coalesce(public.match_results.away_goals, excluded.away_goals);
	return new;
end;
$$;

drop trigger if exists games_sync_match_results on public.games;
create trigger games_sync_match_results
after insert or update on public.games
for each row execute function public.sync_game_fixture_to_match_results();

alter table public.match_results enable row level security;
alter table public.team_stats enable row level security;
alter table public.admins enable row level security;

create policy match_results_public_read on public.match_results for select to anon, authenticated using (true);
create policy team_stats_public_read on public.team_stats for select to anon, authenticated using (true);
grant select on public.match_results, public.team_stats to anon, authenticated;
grant all on public.match_results, public.team_stats, public.admins to service_role;

select public.refresh_team_stats();
