# Collint

College intelligence for partnership due diligence. One search, one dossier, one executive view. Every number carries its source, date and verification status.

v1 is a clickable prototype on fictional sample data. There are no live connectors to AISHE, NIRF, NAAC, AICTE or UGC; data enters through Excel/CSV import.

## What it does

- **Pipeline** board of institutions by deal stage (screening, diligence, negotiation, partnered, passed).
- **Dossier** per institution: overview, admissions, placements, accreditation, campus, commercial (with what-if), promoter and legal records, risks.
- **Claim vs verified**: a college's own figure and the university/government figure for the same metric sit side by side with the gap.
- **Evidence gaps**: every missing, unverified or disputed metric, grouped by who to ask, exported as a data-request letter.
- **Notes & stage**: analyst notes, decisions and stage history.
- **Source ledger**, printable **executive brief**, **compare**, Excel/CSV **import** with rollback.
- Verified-only lens, light/dark theme, Ctrl+K command palette.

## Run

Two terminals:

```bash
npm run db      # local Postgres on localhost:5433, data in ./.pgdata (no Docker)
npm run dev     # http://localhost:3000
```

First time only, with the database running:

```bash
npx prisma db push
npm run db:seed
```

Tests: `npm test`.

## Layout

- `prisma/schema.prisma` — data model. `Fact` holds almost everything; several Facts on the same metric and period from different sources is how claim-vs-verified works.
- `src/lib/metrics.ts` — registry of valid metric keys and source precedence.
- `src/lib/facts.ts` — headline pick, series, variance, utilisation, coverage, formatting.
- `src/lib/risk.ts` — rule-driven flags. No overall score is computed.
- `src/lib/import/` — Excel/CSV template, parser, validation, commit, rollback.
- `src/components/evidence/` — evidence chip, Trust lens, claim-vs-verified, coverage meter.
