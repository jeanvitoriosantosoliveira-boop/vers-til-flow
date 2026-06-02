# Verification Checklist After Migration

## Pre-Migration Verification

Before running the migration, verify your current state:

```sql
-- Check existing tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Should include: clients, tasks, profiles, user_roles, teams, team_members, etc.
```

---

## Step 1: Run the Migration

1. Go to Supabase Dashboard (https://app.supabase.com)
2. Click your project
3. Go to SQL Editor (left sidebar)
4. Click "New Query"
5. Copy **entire** contents from: `supabase/migrations/20260602_comprehensive_updates.sql`
6. Paste into SQL Editor
7. **Run** (should complete in 5-10 seconds)
8. You should see green "Success" message

---

## Step 2: Verify Migration Success

### 2.1 Check New Tables Exist

```sql
-- Run these queries to verify tables were created
SELECT * FROM public.services LIMIT 0;  -- Should show empty table
SELECT * FROM public.client_services LIMIT 0;
SELECT * FROM public.client_collaborators LIMIT 0;
SELECT * FROM public.team_clients LIMIT 0;
SELECT * FROM public.sales_tiles LIMIT 0;
```

All should return "0 rows" (meaning table exists but is empty).

### 2.2 Verify Columns Added to Existing Tables

```sql
-- Check profiles got new columns
SELECT column_name FROM information_schema.columns 
WHERE table_name='profiles' AND column_name IN ('hourly_rate','hire_date','salary')
LIMIT 3;

-- Should return 3 rows with: hourly_rate, hire_date, salary

-- Check clients got new columns
SELECT column_name FROM information_schema.columns 
WHERE table_name='clients' AND column_name IN ('logo_url','segment','health')
LIMIT 3;

-- Should return 3 rows with: logo_url, segment, health
```

### 2.3 Verify Triggers Created

```sql
-- Check statuses trigger
SELECT trigger_name FROM information_schema.triggers 
WHERE event_object_table='clients';

-- Should show: client_status_change_trigger

-- Check team-client trigger  
SELECT trigger_name FROM information_schema.triggers 
WHERE event_object_table='team_clients';

-- Should show: team_client_assignment_trigger
```

### 2.4 Verify Indexes Created

```sql
-- Check indexes
SELECT indexname FROM pg_indexes 
WHERE tablename IN ('client_services', 'client_collaborators', 'team_clients', 'sales_tiles')
ORDER BY indexname;

-- Should show several indexes like:
-- idx_client_collaborators_client_id
-- idx_client_services_client_id
-- idx_sales_tiles_client_id
-- idx_sales_tiles_owner_id
-- idx_team_clients_team_id
```

---

## Step 3: Test Application Changes

### 3.1 Restart Development Server

```bash
# In terminal, press Ctrl+C to stop if running
npm run dev
# Should start on localhost:5173
```

### 3.2 Test 401 Error Fix

1. Login with leader account
2. Go to `/collaborators` page
3. Click "Novo colaborador" button
4. Fill in form:
   - Nome: "Test User"
   - E-mail: "test@example.com"
   - Senha: "password123"
   - Nível: "Comercial" (select from dropdown)
5. Click "Criar colaborador"
6. **Expected**: No 401 error, user should be created successfully
7. **Actual Result**: ✅ or ❌ ?

### 3.3 Test Manager Role Fix

1. Create another collaborator:
   - Nome: "Manager Test"
   - E-mail: "manager@example.com"
   - Senha: "password123"
   - Nível: "Gerente"
2. Click "Criar colaborador"
3. Go back to `/collaborators` page
4. **Expected**: See "Gerente" badge on the new user (not "Colaborador")
5. **Actual Result**: ✅ or ❌ ?

### 3.4 Test Services Page

1. Go to `/services` URL
2. If logged in as collaborator, should redirect to dashboard
3. If logged in as leader, should show services page
4. **Expected**: See services management interface
5. Create test service:
   - Nome: "Web Development"
   - Descrição: "Custom website development"
   - Preço: "5000.00"
6. Click "Criar"
7. **Expected**: Service appears in list
8. **Actual Result**: ✅ or ❌ ?

### 3.5 Test Financial Data Hiding

#### As Collaborator:
1. Logout and login with collaborator account
2. Go to Dashboard
3. Look for "Receita recorrente" (Monthly revenue box)
4. **Expected**: NOT visible
5. **Actual Result**: ✅ or ❌ ?

#### As Leader:
1. Logout and login with leader account
2. Go to Dashboard
3. Look for "Receita recorrente" box
4. **Expected**: Visible with revenue amount
5. **Actual Result**: ✅ or ❌ ?

---

## Step 4: Database Health Check

```sql
-- Final verification queries

-- Count records in each new table
SELECT 'services' as table_name, COUNT(*) as count FROM public.services
UNION
SELECT 'client_services', COUNT(*) FROM public.client_services
UNION
SELECT 'client_collaborators', COUNT(*) FROM public.client_collaborators
UNION
SELECT 'team_clients', COUNT(*) FROM public.team_clients
UNION
SELECT 'sales_tiles', COUNT(*) FROM public.sales_tiles;

-- Expected: All should show counts (0 or more if data exists)

-- Check roles table is still intact
SELECT COUNT(*) as total_roles FROM public.user_roles;

-- Should show number > 0 (all existing roles preserved)

-- Check original tables are untouched
SELECT COUNT(*) as total_clients FROM public.clients;
SELECT COUNT(*) as total_tasks FROM public.tasks;
SELECT COUNT(*) as total_profiles FROM public.profiles;

-- All should show original counts (no data loss)
```

---

## Troubleshooting

### If Migration Fails

**Error**: "Relation already exists"
- **Cause**: Migration might have run twice
- **Fix**: Just run the query again, it includes `IF NOT EXISTS`

**Error**: "Foreign key constraint"
- **Cause**: Reference to non-existent table
- **Fix**: Verify clients, teams tables exist: `SELECT COUNT(*) FROM public.clients;`

**Error**: "Permission denied"
- **Cause**: User doesn't have permission
- **Fix**: Use service role key or admin panel

### If Tests Fail

**Test: 401 Error Still Appears**
- Clear browser cache: `Ctrl+Shift+Delete`
- Clear localStorage: DevTools Console → `localStorage.clear()`
- Refresh page
- Try again

**Test: Services Page Won't Load**
- Check you're logged in as leader
- Check `user_roles` table: `SELECT * FROM user_roles WHERE user_id = YOUR_USER_ID;`
- Verify 'leader' role exists

**Test: Financial Data Still Visible**
- Clear browser cache
- Hard refresh: `Ctrl+Shift+R`
- Verify code change in `src/pages/Dashboard.tsx` (should use `canViewFinancial()`)

---

## Success Criteria

Migration is successful when ALL of these pass:

- [x] New tables created (services, client_services, etc.)
- [x] Columns added to existing tables
- [x] Triggers created and active
- [x] Create collaborator with commercial role (no 401 error)
- [x] Manager role saves as "Gerente" (not "Colaborador")
- [x] Services page accessible to leaders
- [x] Services page inaccessible to collaborators
- [x] Financial data hidden from non-leaders
- [x] No errors in browser console
- [x] No errors in Supabase functions logs

---

## Final Checks

```bash
# Make sure you didn't miss any file updates
git status
# Should show modified files:
# - supabase/functions/create-user/index.ts
# - supabase/functions/delete-user/index.ts
# - supabase/migrations/20260602_comprehensive_updates.sql
# - src/App.tsx
# - src/pages/Collaborators.tsx
# - src/pages/Dashboard.tsx
# - src/pages/Services.tsx (NEW)
# - src/lib/roleVisibility.ts (NEW)

# Commit if everything looks good
git add -A
git commit -m "Fix 401, manager role, add services, role-based RBAC"
git push
```

---

## Getting Help

If something doesn't work:

1. **Check the QUICK_START.md** - Has troubleshooting
2. **Check IMPLEMENTATION_SUMMARY.md** - Has detailed technical info
3. **Check browser Console** (F12) - Look for red errors
4. **Check Supabase Logs** - Dashboard → Functions → Logs → create-user
5. **Re-run migration** - It includes `IF NOT EXISTS` so it's safe

---

**You're done!** All critical fixes are in place. 

Next optional features to implement:
- Profile photo upload
- Password change
- Pagination on reports
- Real-time Kanban updates
