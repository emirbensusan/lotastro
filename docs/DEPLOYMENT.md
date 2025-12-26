# LotAstro WMS Deployment Guide

## Overview

LotAstro WMS uses a **Lovable → GitHub → Supabase** deployment pipeline. Changes made in Lovable automatically sync to GitHub and deploy to Supabase.

---

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Lovable   │────▶│    GitHub    │────▶│    Supabase     │
│   Editor    │     │  Repository  │     │   (Backend)     │
└─────────────┘     └──────────────┘     └─────────────────┘
       │                   │                      │
       ▼                   ▼                      ▼
  Frontend Dev        Version Control      Edge Functions
  + Prototyping       + CI/CD Triggers     Database
                                           Storage
                                           Auth
```

---

## Environments

| Environment | URL | Purpose |
|-------------|-----|---------|
| **Preview** | `*.lovable.app` | Development/staging |
| **Production** | Custom domain | Live system |
| **Supabase** | `kwcwbyfzzordqwudixvl.supabase.co` | Backend services |

---

## Deployment Process

### Frontend Deployment

1. **Make changes in Lovable**
   - Edit code via AI prompts or direct editing
   - Changes auto-save and build

2. **Preview changes**
   - Use the preview pane to verify
   - Test functionality before publishing

3. **Publish to production**
   - Click "Publish" button in top-right
   - Select "Update" to deploy changes
   - Wait for deployment confirmation

4. **Verify deployment**
   - Visit production URL
   - Test critical paths
   - Check browser console for errors

### Backend Deployment (Edge Functions)

Edge functions deploy **automatically** when saved in Lovable:

1. Edit function in `supabase/functions/[function-name]/index.ts`
2. Save changes
3. Function deploys automatically to Supabase
4. Verify in Supabase Dashboard → Edge Functions

### Database Migrations

1. **Create migration**
   - Use Lovable's migration tool
   - Write SQL in migration dialog

2. **Review migration**
   - Check SQL syntax
   - Verify RLS policies included
   - Confirm indexes if needed

3. **Apply migration**
   - Click "Apply" in Lovable
   - Migration runs against Supabase

4. **Verify**
   - Check Supabase Dashboard → Database
   - Verify tables/columns created
   - Test affected functionality

---

## Configuration

### Environment Variables / Secrets

Secrets are managed in Supabase Dashboard → Settings → Edge Functions:

| Secret | Purpose | Required |
|--------|---------|----------|
| `SUPABASE_URL` | Supabase project URL | ✅ |
| `SUPABASE_ANON_KEY` | Public API key | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin API key | ✅ |
| `RESEND_API_KEY` | Email delivery | ✅ |
| `CRON_SECRET` | Scheduled job auth | ✅ |
| `LOVABLE_API_KEY` | AI features | Optional |

### Adding a New Secret

1. Go to Supabase Dashboard → Settings → Edge Functions
2. Click "Add Secret"
3. Enter name and value
4. Save

### Updating a Secret

1. Go to Supabase Dashboard → Settings → Edge Functions
2. Find the secret
3. Click edit, enter new value
4. Save
5. **Important**: Redeploy affected edge functions

---

## Rollback Procedures

### Frontend Rollback

**Option 1: Lovable Version History**
1. Open Lovable editor
2. Click project name → "Version History"
3. Select previous working version
4. Click "Restore"
5. Publish the restored version

**Option 2: GitHub Revert**
1. Go to GitHub repository
2. Find the problematic commit
3. Create revert commit
4. Push to main branch
5. Changes sync back to Lovable

### Edge Function Rollback

1. Find previous version in GitHub history
2. Copy the old function code
3. Paste into Lovable editor
4. Save to trigger redeployment

### Database Rollback

**For schema changes:**
1. Write reverse migration SQL
2. Apply via Lovable migration tool
3. Test affected functionality

**For data recovery:**
1. Contact Supabase support for backup restore
2. Or restore from daily backup (Pro plan)
3. Verify data integrity after restore

---

## Pre-Deployment Checklist

### Before Any Deployment

- [ ] All tests pass locally
- [ ] No console errors in preview
- [ ] Functionality tested in preview
- [ ] RLS policies reviewed for new tables
- [ ] Translations added for new UI text

### Before Production Deployment

- [ ] Preview deployment verified
- [ ] Critical user flows tested
- [ ] Database migrations applied successfully
- [ ] Edge functions deployed and tested
- [ ] Rollback plan documented

### Post-Deployment Verification

- [ ] Production site loads
- [ ] Authentication works
- [ ] Critical features functional
- [ ] No errors in console
- [ ] Check Supabase logs for errors

---

## Monitoring

### Health Checks

**Frontend:**
- Load production URL
- Check for JavaScript errors
- Verify API calls succeed

**Backend:**
- Supabase Dashboard → Database → Health
- Edge Functions → Logs (check for errors)
- Auth → Users (verify auth working)

### Log Locations

| Component | Location |
|-----------|----------|
| Frontend | Browser DevTools Console |
| Edge Functions | Supabase Dashboard → Edge Functions → [name] → Logs |
| Database | Supabase Dashboard → Logs → Postgres |
| Auth | Supabase Dashboard → Logs → Auth |

### Key Metrics to Monitor

1. **API Response Times** - Should be < 500ms
2. **Error Rates** - Should be < 1%
3. **Database Connections** - Should be < 80% of pool
4. **Storage Usage** - Monitor bucket sizes
5. **Edge Function Invocations** - Track for billing

---

## Troubleshooting

### Build Failures in Lovable

1. Check for TypeScript errors in the console
2. Verify all imports are correct
3. Check for circular dependencies
4. Try clearing browser cache

### Edge Function Not Deploying

1. Check function syntax for errors
2. Verify `index.ts` is in correct location
3. Check Supabase function logs
4. Try manual redeployment

### Database Migration Fails

1. Check SQL syntax
2. Verify no conflicting schema
3. Check for FK constraint issues
4. Review RLS policy syntax

### Styles Not Updating

1. Clear browser cache
2. Hard refresh (Ctrl+Shift+R)
3. Check for CSS specificity issues
4. Verify Tailwind classes are valid

---

## Security Considerations

### Before Deploying

1. **Never commit secrets** to code
2. **Review RLS policies** for new tables
3. **Validate input** on all edge functions
4. **Check CORS settings** if needed

### Access Control

| Action | Who Can Do It |
|--------|---------------|
| Deploy frontend | Lovable project members |
| Deploy edge functions | Lovable project members |
| Run migrations | Lovable project members |
| Access Supabase Dashboard | Supabase project members |
| Manage secrets | Supabase project admins |

---

## Emergency Procedures

### Complete System Down

1. Check Supabase status page
2. Check Lovable status
3. If Supabase down, wait for their resolution
4. If code issue, rollback to last known good version
5. Notify users of outage

### Security Incident

1. Immediately revoke compromised credentials
2. Check audit logs for unauthorized access
3. Reset affected user sessions
4. Document timeline and actions
5. Follow incident response plan

### Data Loss

1. Stop all write operations if possible
2. Contact Supabase support immediately
3. Request point-in-time recovery
4. Document what data was affected
5. Communicate with affected users

---

## Contacts

| Role | Contact | Availability |
|------|---------|--------------|
| Supabase Support | support@supabase.io | 24/7 |
| Lovable Support | support@lovable.dev | Business hours |
| GitHub Support | support@github.com | 24/7 |

---

## Appendix: Useful Commands

### Check Deployment Status
```bash
# Check if edge function is responding
curl -I https://kwcwbyfzzordqwudixvl.supabase.co/functions/v1/[function-name]
```

### Database Quick Checks
```sql
-- Check recent errors
SELECT * FROM postgres_logs 
WHERE parsed.error_severity = 'ERROR'
ORDER BY timestamp DESC 
LIMIT 10;

-- Check active queries
SELECT pid, query, state, query_start 
FROM pg_stat_activity 
WHERE state = 'active';
```
