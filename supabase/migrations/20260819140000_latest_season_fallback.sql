-- На public.seasons включена RLS без политики для anon, поэтому подзапрос
-- внутри get_leaderboard_by_season() под anon-ключом молча возвращал ноль
-- строк, и фолбэк "сезон не передан -> последний сезон" не срабатывал.
--
-- Выносим чтение в security definer функцию: так фолбэк работает, но anon не
-- получает доступ ко всей таблице seasons.

create or replace function public.latest_season()
returns text
language sql
stable
security definer
set search_path = public
as $$
	select s.code from public.seasons s order by s.created_at desc limit 1
$$;

revoke all on function public.latest_season() from public;
grant execute on function public.latest_season() to anon, authenticated;

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
	v_season text := coalesce(p_season, public.latest_season());
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
