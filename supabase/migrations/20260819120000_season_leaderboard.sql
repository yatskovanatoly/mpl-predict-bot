-- Таблица лидеров по сезонам.
--
-- public.leaderboard остаётся как есть (общий зачёт за всё время, его пишет
-- существующий триггер начисления очков) — ничего не обнуляем и не ломаем.
-- Таблица текущего сезона считается из public.predictions по статусам прогнозов,
-- завершённые сезоны замораживаются в public.season_standings.

-- 1. Архив завершённых сезонов ------------------------------------------------

create table if not exists public.season_standings (
	id uuid primary key default gen_random_uuid(),
	season text not null,
	user_id bigint not null,
	username text,
	first_name text,
	last_name text,
	points integer not null default 0,
	place integer not null,
	created_at timestamptz not null default now(),
	unique (season, user_id)
);

create index if not exists season_standings_season_points_idx
	on public.season_standings (season, points desc);

alter table public.season_standings enable row level security;

drop policy if exists "season_standings_read" on public.season_standings;
create policy "season_standings_read" on public.season_standings
	for select to anon, authenticated using (true);

-- RLS-политики мало: нужен ещё табличный grant, иначе бот с anon-ключом
-- получит "permission denied for table season_standings".
grant select on public.season_standings to anon, authenticated;

-- 2. Очки за прогноз ----------------------------------------------------------

create or replace function public.prediction_points(p_status public.status)
returns integer
language sql
immutable
as $$
	select case p_status
		when 'score' then 5
		when 'difference' then 3
		when 'winner' then 1
		else 0
	end
$$;

-- 3. Живой подсчёт очков за сезон из прогнозов --------------------------------

create or replace function public.season_standings_computed(p_season text)
returns table (
	user_id bigint,
	username text,
	first_name text,
	last_name text,
	points integer
)
language sql
stable
as $$
	with totals as (
		select
			p.user_id::bigint as user_id,
			sum(public.prediction_points(p.status))::integer as points,
			(array_agg(p.username order by p.created_at desc))[1] as username,
			(array_agg(p.first_name order by p.created_at desc))[1] as first_name,
			(array_agg(p.last_name order by p.created_at desc))[1] as last_name
		from public.predictions p
		where p.season = p_season
			and p.user_id is not null
		group by p.user_id
	)
	select
		t.user_id,
		coalesce(l.username, t.username) as username,
		coalesce(l.first_name, t.first_name) as first_name,
		coalesce(l.last_name, t.last_name) as last_name,
		t.points
	from totals t
	left join public.leaderboard l on l.user_id = t.user_id
	where t.points > 0
$$;

-- 4. Таблица лидеров за сезон (архив приоритетнее живого подсчёта) ------------

create or replace function public.get_leaderboard_by_season(
	p_season text default null,
	page integer default 1,
	page_size integer default 10
)
returns json
language plpgsql
stable
as $$
declare
	v_size integer := greatest(1, least(coalesce(page_size, 10), 50));
	v_page integer := greatest(1, coalesce(page, 1));
	v_season text := coalesce(
		p_season,
		(select s.code from public.seasons s order by s.created_at desc limit 1)
	);
begin
	return (
		with archived as (
			select s.user_id, s.username, s.first_name, s.last_name, s.points, s.place
			from public.season_standings s
			where s.season = v_season
		),
		base as (
			select * from archived
			union all
			select
				c.user_id, c.username, c.first_name, c.last_name, c.points,
				(dense_rank() over (order by c.points desc))::integer as place
			from public.season_standings_computed(v_season) c
			where not exists (select 1 from archived)
		),
		ordered as (
			select b.*, row_number() over (order by b.place, b.user_id) as rn
			from base b
		),
		bounds as (
			select
				count(*)::integer as total,
				greatest(1, ceil(count(*)::numeric / v_size)::integer) as total_pages
			from ordered
		),
		pageinfo as (
			select least(v_page, b.total_pages) as page, b.total_pages, b.total
			from bounds b
		),
		sliced as (
			select o.*
			from ordered o, pageinfo pi
			where o.rn > (pi.page - 1) * v_size and o.rn <= pi.page * v_size
		),
		grouped as (
			select
				s.place,
				json_agg(
					json_build_object(
						'user_id', s.user_id,
						'username', s.username,
						'first_name', s.first_name,
						'last_name', s.last_name,
						'points', s.points
					) order by s.user_id
				) as users
			from sliced s
			group by s.place
		)
		select json_build_object(
			'data', coalesce(
				(select json_object_agg(g.place::text, g.users) from grouped g),
				'{}'::json
			),
			'season', v_season,
			'is_archived', exists (select 1 from archived),
			'page', (select pi.page from pageinfo pi),
			'total_pages', (select pi.total_pages from pageinfo pi),
			'total', (select pi.total from pageinfo pi)
		)
	);
end;
$$;

-- 5. Список прошедших сезонов -------------------------------------------------
-- Сезон попадает сюда, как только по нему есть прогнозы, — заранее замораживать
-- его через archive_season() не обязательно. Текущий сезон отсеивает бот.

create or replace function public.get_archived_seasons()
returns json
language sql
stable
as $$
	select coalesce(
		json_agg(
			s.season
			order by
				case
					when s.season ~ '^\d{2}-\d{4}' then to_date(left(s.season, 7), 'MM-YYYY')
				end desc nulls last,
				s.season desc
		),
		'[]'::json
	)
	from (
		select distinct season from public.season_standings
		union
		select distinct season from public.predictions where season is not null
	) s
$$;

-- 6. Заморозка итогов сезона --------------------------------------------------
-- Вызывать один раз после последнего тура сезона:
--   select public.archive_season('08-2026, 07-2027');

create or replace function public.archive_season(p_season text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
	v_count integer;
begin
	insert into public.season_standings (
		season, user_id, username, first_name, last_name, points, place
	)
	select
		p_season, c.user_id, c.username, c.first_name, c.last_name, c.points,
		(dense_rank() over (order by c.points desc))::integer
	from public.season_standings_computed(p_season) c
	on conflict (season, user_id) do update set
		username = excluded.username,
		first_name = excluded.first_name,
		last_name = excluded.last_name,
		points = excluded.points,
		place = excluded.place;

	get diagnostics v_count = row_count;
	return v_count;
end;
$$;

-- revoke от anon/authenticated недостаточно: execute остаётся у PUBLIC.
revoke all on function public.archive_season(text) from public, anon, authenticated;

-- 7. Сезон 08-2025, 06-2026 -> архив ------------------------------------------
-- Берём итог из public.leaderboard, а не из прогнозов: части игроков очки за
-- первые туры проставили вручную (импорт из tmp_import), и пересчёт по
-- прогнозам их бы потерял.

insert into public.season_standings (
	season, user_id, username, first_name, last_name, points, place
)
select
	'08-2025, 06-2026',
	l.user_id,
	l.username,
	l.first_name,
	l.last_name,
	l.points,
	(dense_rank() over (order by l.points desc))::integer
from public.leaderboard l
where l.user_id is not null
	and coalesce(l.points, 0) > 0
on conflict (season, user_id) do nothing;
