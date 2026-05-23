# Supabase migrations

This directory will hold SQL migration files for the database schema.

Naming convention: `YYYYMMDDHHMMSS_short_description.sql`

Example:
```
20260601120000_initial_schema.sql
20260601120100_rls_policies.sql
20260601120200_seed_dev_data.sql
```

To apply migrations locally with the Supabase CLI:
```bash
supabase migration up
```

To push to your hosted Supabase project:
```bash
supabase db push
```
