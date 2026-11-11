create or replace function public.is_telegram_admin(p_telegram_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
	select exists (
		select 1 from public.admins where telegram_id = p_telegram_id
	);
$$;

revoke all on function public.is_telegram_admin(bigint) from public;
grant execute on function public.is_telegram_admin(bigint) to anon, authenticated, service_role;
