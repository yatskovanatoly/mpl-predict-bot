-- Schedule the Friday tour reminder (Friday 18:00 MSK = 15:00 UTC).
-- Run once in the Supabase SQL editor after deploying the friday-reminder function.
--
-- Prerequisites: pg_cron and pg_net extensions enabled.
-- Replace YOUR_PROJECT_REF and YOUR_SERVICE_ROLE_KEY before running.

do $body$
declare
  job_id bigint;
begin
  select jobid into job_id
  from cron.job
  where jobname = 'friday-tour-reminder';

  if job_id is not null then
    perform cron.unschedule(job_id);
  end if;
end
$body$;

select cron.schedule(
  'friday-tour-reminder',
  '0 15 * * 5',
  $$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/friday-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) as request_id;
  $$
);
