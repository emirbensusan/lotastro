-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant usage on cron schema
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Schedule daily snapshot at 21:00 UTC (midnight Istanbul time)
SELECT cron.schedule(
  'take-daily-snapshot',
  '0 21 * * *',
  $$
  SELECT net.http_post(
    url := 'https://kwcwbyfzzordqwudixvl.supabase.co/functions/v1/take-daily-snapshot',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3Y3dieWZ6em9yZHF3dWRpeHZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxMDY2MTksImV4cCI6MjA3MTY4MjYxOX0.toD6pqqb2w1YBa7LQSWLXb0WI9_6wsGJFLsnSm_BPNM'
    ),
    body := jsonb_build_object('scheduled', true)
  ) AS request_id;
  $$
);