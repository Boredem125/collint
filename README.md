# Institution Intelligence Platform (IIP)

One search, one profile, one executive view for college partnership due diligence. Every number carries its source, date and verification status.

v1 is a clickable prototype on fictional sample data. There are no live connectors to AISHE, NIRF, NAAC, AICTE or UGC; data enters through Excel/CSV import.

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
