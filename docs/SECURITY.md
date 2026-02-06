# Security Model Documentation

## Overview

This document describes the Row Level Security (RLS) implementation for the Certificator application. The security model ensures complete data isolation between users while allowing administrative access for system health monitoring.

## Core Principles

1. **Default Deny**: All tables have RLS enabled with no default access
2. **Explicit Whitelist**: Only explicitly granted permissions are allowed
3. **User Isolation**: Users can only access their own data
4. **Service Role Privilege**: Administrative operations use service role key

## Table-Level Security

### 1. Templates Table

**Purpose**: Store PDF certificate template metadata

**RLS Policies**:

| Operation | Policy | Rule |
|-----------|--------|------|
| SELECT | View own templates | `auth.uid() = owner_id` |
| INSERT | Insert own templates | `auth.uid() = owner_id` |
| UPDATE | Update own templates | `auth.uid() = owner_id` |
| DELETE | Delete own templates | `auth.uid() = owner_id` |

**Security Guarantees**:
- Users can only see templates they created
- Users cannot access other users' templates
- Unauthenticated users have no access
- All operations require authentication

**Implementation**:
```sql
-- Example: SELECT policy
CREATE POLICY "Users can view their own templates"
    ON public.templates
    FOR SELECT
    USING (auth.uid() = owner_id);
```

### 2. Layouts Table

**Purpose**: Store field configurations for templates

**RLS Policies**:

| Operation | Policy | Rule |
|-----------|--------|------|
| SELECT | View layouts for own templates | Template owned by user |
| INSERT | Insert layouts for own templates | Template owned by user |
| UPDATE | Update layouts for own templates | Template owned by user |
| DELETE | Delete layouts for own templates | Template owned by user |

**Security Guarantees**:
- Users can only access layouts for templates they own
- Indirect ownership check through template relationship
- Prevents unauthorized layout modifications
- Cascade deletion when template is deleted

**Implementation**:
```sql
-- Example: SELECT policy with JOIN
CREATE POLICY "Users can view layouts for their own templates"
    ON public.layouts
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.templates
            WHERE templates.id = layouts.template_id
            AND templates.owner_id = auth.uid()
        )
    );
```

### 3. System Health Table

**Purpose**: Keep-alive mechanism for database activity

**RLS Policies**:
- **NO PUBLIC ACCESS**: No policies defined for regular users
- **SERVICE ROLE ONLY**: Only service_role key can access

**Security Guarantees**:
- Public anon key has zero access
- Cannot be read or modified by authenticated users
- Only internal keep-alive service can update
- Prevents data leakage about system status

**Implementation**:
```sql
-- No policies = No access for anon/authenticated roles
-- Service role bypasses RLS by default
ALTER TABLE public.system_health ENABLE ROW LEVEL SECURITY;
```

## Authentication Flow

### 1. Browser Client (Public Access)

**Key Used**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Access Level**:
- RLS policies enforced
- Can only access own data
- Requires authentication for all operations

**Use Cases**:
- User-facing features
- Template management
- Layout editing
- Certificate generation

### 2. Server Client (Authenticated Access)

**Key Used**: `NEXT_PUBLIC_SUPABASE_ANON_KEY` + Cookie Auth

**Access Level**:
- RLS policies enforced
- Session-based authentication
- Secure server-side operations

**Use Cases**:
- Server Components
- API Routes (user operations)
- Server Actions

### 3. Admin Client (Privileged Access)

**Key Used**: `SUPABASE_SERVICE_ROLE_KEY`

**Access Level**:
- **BYPASSES RLS**
- Full database access
- Must never be exposed to client

**Use Cases**:
- Keep-alive health checks
- System maintenance
- Administrative operations

⚠️ **WARNING**: The service role key must NEVER be used in client-side code or exposed in environment variables prefixed with `NEXT_PUBLIC_`.

## Data Isolation Examples

### Example 1: User A Cannot Access User B's Templates

```typescript
// User A (authenticated as user-a-uuid)
const { data } = await supabase
  .from('templates')
  .select('*');

// Returns: Only templates where owner_id = user-a-uuid
// User B's templates are invisible to User A
```

### Example 2: Cascade Security Through Relationships

```typescript
// User A tries to access a layout for User B's template
const { data } = await supabase
  .from('layouts')
  .select('*')
  .eq('template_id', 'user-b-template-uuid');

// Returns: Empty array (no access)
// Even though the layout exists, User A doesn't own the template
```

### Example 3: Service Role Access to System Health

```typescript
// Regular authenticated user
const { data } = await supabase
  .from('system_health')
  .select('*');
// Returns: Error (RLS denies access)

// Admin client with service role
const adminClient = createAdminClient();
const { data } = await adminClient
  .from('system_health')
  .update({ last_pulse: new Date().toISOString() })
  .eq('id', '00000000-0000-0000-000000000001');
// Returns: Success (bypasses RLS)
```

## Security Testing Checklist

Before deploying, verify these security requirements:

- [ ] **Template Isolation**: User A cannot read User B's templates
- [ ] **Template Isolation**: User A cannot update User B's templates
- [ ] **Template Isolation**: User A cannot delete User B's templates
- [ ] **Layout Isolation**: User A cannot read layouts for User B's templates
- [ ] **Layout Isolation**: User A cannot update layouts for User B's templates
- [ ] **System Health**: Authenticated users cannot read system_health
- [ ] **System Health**: Authenticated users cannot update system_health
- [ ] **Service Role**: Admin client can update system_health
- [ ] **Unauthenticated**: Anon users cannot access any data

## Common Security Pitfalls

### ❌ DON'T: Expose Service Role Key

```typescript
// WRONG - Never do this!
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // ❌ Exposed to client
);
```

### ✅ DO: Use Appropriate Client

```typescript
// Client Component - Public access with RLS
'use client';
import { createClient } from '@/lib/supabase';

export default function MyComponent() {
  const supabase = createClient(); // ✅ Anon key with RLS
}
```

```typescript
// API Route - Admin access (server-side only)
import { createAdminClient } from '@/lib/supabase';

export async function POST() {
  const adminClient = createAdminClient(); // ✅ Service role (server-only)
  // Update system_health...
}
```

### ❌ DON'T: Trust Client Input for owner_id

```typescript
// WRONG - Client can fake owner_id
const { data } = await supabase
  .from('templates')
  .insert({
    owner_id: userId, // ❌ Don't trust client input
    name: 'My Template',
    image_url: 'https://...'
  });
```

### ✅ DO: Use auth.uid() in RLS Policies

```sql
-- RLS policy ensures auth.uid() is used
CREATE POLICY "Users can insert their own templates"
    ON public.templates
    FOR INSERT
    WITH CHECK (auth.uid() = owner_id);
```

The RLS policy will reject the insert if the authenticated user's ID doesn't match the provided `owner_id`.

## Monitoring and Auditing

### Recommended Practices

1. **Log Failed RLS Checks**: Monitor Supabase logs for RLS policy violations
2. **Regular Security Audits**: Review RLS policies quarterly
3. **Test After Schema Changes**: Run security checklist after migrations
4. **Principle of Least Privilege**: Only grant necessary permissions

### Supabase Dashboard Monitoring

- Navigate to **Database** → **Policies** to view all RLS policies
- Use **SQL Editor** to test queries as different users
- Check **Logs** for unauthorized access attempts

## Conclusion

This security model ensures:
- ✅ Complete data isolation between users
- ✅ Zero trust client-side
- ✅ Service role for administrative tasks only
- ✅ Defense in depth with RLS + authentication

All security policies are defined in `supabase/migrations/20240101000000_initial_schema.sql` and must be maintained as the schema evolves.
