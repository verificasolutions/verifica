# Registro de normalização das migrations

**Data do registro:** 26/08/2026 21:51

- Schema atual exportado do Supabase real.
- Criada baseline única: `20260826120000_baseline_current_schema.sql`.
- 76 migrations antigas arquivadas em `supabase/migrations_legacy_20260826`.
- Histórico remoto normalizado para usar somente a baseline.
- Nenhuma tabela, função ou dado foi apagado.
- `supabase migration list --linked`: local e remoto iguais.
- `supabase db push --linked --dry-run`: **Remote database is up to date**.
- Commit criado: `3e84bd2 chore: baseline current Supabase schema`.

## Regra para novas migrations

Novas migrations devem usar identificadores únicos. O CLI não deve reaplicar o legado arquivado.
