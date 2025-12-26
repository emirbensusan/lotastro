# LotAstro WMS Incident Runbook

## Overview

This runbook provides step-by-step guidance for responding to common incidents in the LotAstro WMS system. All incidents should be documented in the audit logs and communicated to stakeholders.

---

## Severity Levels

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| **P0 - Critical** | System down, data loss risk | < 15 minutes | Database unavailable, auth broken |
| **P1 - High** | Major feature broken | < 1 hour | Order processing failed, email not sending |
| **P2 - Medium** | Feature degraded | < 4 hours | Slow queries, OCR failures |
| **P3 - Low** | Minor issues | < 24 hours | UI bugs, translation missing |

---

## Contact Matrix

| Role | Responsibility | Escalation Path |
|------|----------------|-----------------|
| On-Call Engineer | First responder, initial triage | → Tech Lead |
| Tech Lead | Technical decisions, rollbacks | → CTO |
| Database Admin | Supabase issues, data recovery | → Tech Lead |
| Product Owner | Business decisions, customer comms | → Management |

---

## Incident Types

### 1. Database Connection Failures

**Detection:**
- Error logs: "PGRST" errors, connection timeouts
- Dashboard: Supabase health status red
- User reports: "Unable to load data"

**Response Steps:**
1. Check Supabase Dashboard → Database → Health
2. Verify connection pool status (max connections)
3. Check for long-running queries:
   ```sql
   SELECT pid, now() - pg_stat_activity.query_start AS duration, query
   FROM pg_stat_activity
   WHERE state != 'idle'
   ORDER BY duration DESC;
   ```
4. If pool exhausted, kill idle connections:
   ```sql
   SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE state = 'idle'
   AND query_start < now() - interval '10 minutes';
   ```
5. If persists, restart database from Supabase Dashboard

**Resolution Verification:**
- Test query from application
- Check error rates in logs
- Verify user can load inventory page

---

### 2. Authentication Failures

**Detection:**
- Auth logs show repeated 401/403 errors
- Users report "Unable to login"
- Rate limiting triggered excessively

**Response Steps:**
1. Check Supabase Auth logs:
   ```sql
   SELECT id, timestamp, event_message, metadata
   FROM auth_logs
   ORDER BY timestamp DESC
   LIMIT 50;
   ```
2. Verify JWT secret hasn't changed
3. Check for expired sessions in profiles table
4. If rate-limited, check `login_attempts` table:
   ```sql
   SELECT email, COUNT(*), MAX(attempted_at)
   FROM login_attempts
   WHERE attempted_at > now() - interval '1 hour'
   GROUP BY email
   ORDER BY COUNT(*) DESC;
   ```
5. Clear rate limit if legitimate user:
   ```sql
   DELETE FROM login_attempts WHERE email = 'user@example.com';
   ```

**Resolution Verification:**
- Test login with known good credentials
- Verify session creation in auth logs
- Check user can access protected routes

---

### 3. Edge Function Failures

**Detection:**
- Function logs show errors
- API endpoints returning 500
- Webhook deliveries failing

**Response Steps:**
1. Check function logs in Supabase Dashboard → Edge Functions → [function] → Logs
2. Verify secrets are configured:
   - RESEND_API_KEY
   - CRON_SECRET
   - SUPABASE_SERVICE_ROLE_KEY
3. Check function deployment status
4. Test function manually:
   ```bash
   curl -X POST https://kwcwbyfzzordqwudixvl.supabase.co/functions/v1/[function-name] \
     -H "Authorization: Bearer [anon-key]" \
     -H "Content-Type: application/json" \
     -d '{}'
   ```
5. If failed deployment, redeploy via Lovable

**Resolution Verification:**
- Function returns 200 status
- Expected side effects occur (email sent, data updated)
- No errors in function logs

---

### 4. Email Delivery Failures

**Detection:**
- `email_log` table shows failed status
- Users report not receiving emails
- Resend dashboard shows bounces

**Response Steps:**
1. Check email_log for recent failures:
   ```sql
   SELECT id, recipient, subject, status, error_message, created_at
   FROM email_log
   WHERE status = 'failed'
   ORDER BY created_at DESC
   LIMIT 20;
   ```
2. Verify Resend API key is valid
3. Check Resend dashboard for:
   - API rate limits
   - Domain verification status
   - Bounce/spam reports
4. If domain issue, re-verify in Resend
5. Retry failed emails:
   ```sql
   UPDATE email_log
   SET status = 'pending', retry_count = 0, next_retry_at = now()
   WHERE id = '[email-id]';
   ```
   Then trigger `process-email-retries` function

**Resolution Verification:**
- Send test email via admin panel
- Check email_log shows 'sent' status
- Verify email received in inbox

---

### 5. Stock Take OCR Failures

**Detection:**
- OCR queue building up
- Low confidence scores across sessions
- Users report manual entry required

**Response Steps:**
1. Check OCR queue status:
   ```sql
   SELECT status, COUNT(*)
   FROM count_rolls
   WHERE ocr_status IS NOT NULL
   GROUP BY status;
   ```
2. Verify storage bucket accessibility
3. Check `stock-take-ocr` function logs
4. Test OCR with known good image
5. If API quota exceeded, wait or upgrade plan

**Resolution Verification:**
- New uploads process successfully
- Confidence scores return to normal
- Queue length decreasing

---

### 6. Reservation Conflicts

**Detection:**
- Users report "insufficient stock" errors
- Reserved meters don't match calculations
- Audit logs show unexpected changes

**Response Steps:**
1. Check reservation integrity:
   ```sql
   SELECT l.id, l.quality, l.color, l.meters, l.reserved_meters,
          COALESCE(SUM(rl.reserved_meters), 0) as calculated_reserved
   FROM lots l
   LEFT JOIN reservation_lines rl ON l.id = rl.lot_id
   WHERE l.status = 'in_stock'
   GROUP BY l.id
   HAVING l.reserved_meters != COALESCE(SUM(rl.reserved_meters), 0);
   ```
2. Identify orphaned reservations:
   ```sql
   SELECT rl.* FROM reservation_lines rl
   LEFT JOIN reservations r ON rl.reservation_id = r.id
   WHERE r.id IS NULL;
   ```
3. Fix mismatched reserved_meters:
   ```sql
   UPDATE lots l SET reserved_meters = (
     SELECT COALESCE(SUM(rl.reserved_meters), 0)
     FROM reservation_lines rl
     JOIN reservations r ON rl.reservation_id = r.id
     WHERE rl.lot_id = l.id AND r.status = 'active'
   );
   ```

**Resolution Verification:**
- Run integrity check again
- Test new reservation creation
- Verify inventory calculations correct

---

### 7. Performance Degradation

**Detection:**
- Slow page loads (> 3s)
- Database queries timing out
- High CPU/memory in Supabase

**Response Steps:**
1. Identify slow queries:
   ```sql
   SELECT query, calls, mean_time, total_time
   FROM pg_stat_statements
   ORDER BY mean_time DESC
   LIMIT 10;
   ```
2. Check for missing indexes on filtered columns
3. Analyze table statistics:
   ```sql
   ANALYZE lots;
   ANALYZE rolls;
   ANALYZE orders;
   ```
4. Check for table bloat:
   ```sql
   SELECT relname, n_dead_tup, n_live_tup
   FROM pg_stat_user_tables
   WHERE n_dead_tup > 1000
   ORDER BY n_dead_tup DESC;
   ```
5. If bloated, schedule VACUUM:
   ```sql
   VACUUM ANALYZE lots;
   ```

**Resolution Verification:**
- Page load times < 2s
- Query times return to baseline
- No timeout errors in logs

---

### 8. Data Corruption / Integrity Issues

**Detection:**
- Audit log inconsistencies
- Foreign key violations in logs
- Calculated fields don't match

**Response Steps:**
1. Identify the scope of corruption
2. Check recent audit logs for suspicious activity:
   ```sql
   SELECT * FROM audit_logs
   WHERE created_at > now() - interval '24 hours'
   ORDER BY created_at DESC;
   ```
3. Use `repair-audit-inconsistencies` function if available
4. For critical data, restore from backup (see Deployment docs)
5. Re-run affected calculations

**Resolution Verification:**
- Data integrity checks pass
- Audit trail is consistent
- Users confirm data correctness

---

### 9. CRON Job Failures

**Detection:**
- Scheduled tasks not running
- Digests not sent on schedule
- Forecast not updating

**Response Steps:**
1. Check if CRON secret is configured correctly
2. Verify CRON endpoints in config.toml
3. Check function logs for each scheduled function
4. Manually trigger the function to test:
   ```bash
   curl -X POST https://kwcwbyfzzordqwudixvl.supabase.co/functions/v1/[cron-function] \
     -H "Authorization: Bearer [CRON_SECRET]"
   ```
5. Check Supabase cron schedule configuration

**Resolution Verification:**
- Manual trigger succeeds
- Next scheduled run executes
- Expected side effects occur

---

### 10. API Rate Limiting Issues

**Detection:**
- 429 errors in API logs
- External integrations failing
- api_request_logs showing high volume

**Response Steps:**
1. Check current rate limit status:
   ```sql
   SELECT api_key_id, COUNT(*), MAX(created_at)
   FROM api_request_logs
   WHERE created_at > now() - interval '1 minute'
   GROUP BY api_key_id
   ORDER BY COUNT(*) DESC;
   ```
2. Identify the offending API key
3. If legitimate traffic, increase rate limit:
   ```sql
   UPDATE api_keys
   SET rate_limit_per_minute = 120
   WHERE id = '[api-key-id]';
   ```
4. If abuse, revoke the key:
   ```sql
   UPDATE api_keys SET is_active = false WHERE id = '[api-key-id]';
   ```

**Resolution Verification:**
- API calls succeeding
- Rate within limits
- No 429 errors in logs

---

## Post-Incident Procedures

### 1. Documentation
- Create incident report with timeline
- Document root cause
- List action items for prevention

### 2. Communication
- Notify affected users
- Update status page if applicable
- Brief stakeholders

### 3. Review
- Schedule post-mortem within 48 hours
- Identify process improvements
- Update this runbook if needed

---

## Useful Queries

### System Health Check
```sql
-- Check table sizes
SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC;

-- Check active connections
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';

-- Check for locks
SELECT * FROM pg_locks WHERE NOT granted;
```

### Recent Activity Summary
```sql
-- Orders in last 24h
SELECT COUNT(*), status FROM orders
WHERE created_at > now() - interval '24 hours'
GROUP BY status;

-- Audit actions in last 24h
SELECT action, entity_type, COUNT(*)
FROM audit_logs
WHERE created_at > now() - interval '24 hours'
GROUP BY action, entity_type;
```
