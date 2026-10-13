"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { commitImportAction, previewImport, rollbackBatch } from "@/app/import/actions";
import { SourceBadge, StatusBadge } from "@/components/evidence/Evidence";
import { Card, Empty, Td, Th } from "@/components/ui";
import { fmtDate, fmtNum } from "@/lib/facts";
import type { CommitResult } from "@/lib/import/commit";
import type { ImportPreview } from "@/lib/import/parse";
import type { FactRow, SheetName } from "@/lib/import/schemas";
import { metric } from "@/lib/metrics";

export interface BatchT {
  id: string;
  filename: string;
  createdAt: string;
  accepted: number;
  rejected: number;
  facts: number;
  institutions: { id: string; name: string }[];
}

const SHEET_ORDER: SheetName[] = ["Institution", "Programmes", "Facts", "Promoters", "LegalRecords", "Recruiters"];
const MAX_BYTES = 900 * 1024;

const btn = "rounded-md border px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50";
const primary = `${btn} border-brand bg-brand text-white`;
const secondary = `${btn} border-line bg-surface text-ink hover:bg-canvas`;

function factValue(f: FactRow): string {
  if (f.status === "UNAVAILABLE") return "Not available";
  const unit = metric(f.metricKey)?.unit ?? "count";
  if (unit === "date" && f.valueText) return fmtDate(f.valueText);
  if (f.valueNum !== null) return fmtNum(f.valueNum, unit);
  return f.valueText ?? "Not available";
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="tnum mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line text-xs font-semibold text-muted">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-ink">{title}</div>
        <div className="mt-1.5 text-sm text-muted">{children}</div>
      </div>
    </div>
  );
}

export default function ImportClient({ batches }: { batches: BatchT[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [done, setDone] = useState<CommitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"preview" | "commit" | string | null>(null);
  const [, startTransition] = useTransition();

  const body = () => {
    const fd = new FormData();
    if (file) fd.set("file", file);
    return fd;
  };

  const choose = (f: File | null) => {
    setFile(f);
    setPreview(null);
    setDone(null);
    setError(f && f.size > MAX_BYTES ? "The file is larger than 900 KB. Split it and import in parts." : null);
  };

  const run = async <T,>(kind: string, action: () => Promise<T>, then: (r: T) => void) => {
    setBusy(kind);
    setError(null);
    try {
      then(await action());
    } catch {
      setError("The request failed. Nothing was written. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const onPreview = () =>
    run("preview", () => previewImport(body()), (r) => {
      if (r.ok) setPreview(r.preview);
      else setError(r.error);
    });

  const onCommit = () =>
    run("commit", () => commitImportAction(body()), (r) => {
      if (!r.ok) return setError(r.error);
      setDone(r.result);
      setPreview(null);
      setFile(null);
      if (input.current) input.current.value = "";
      startTransition(() => router.refresh());
    });

  const onRollback = (b: BatchT) => {
    const what = b.institutions.length
      ? `${b.institutions.map((i) => i.name).join(", ")} and everything recorded under ${b.institutions.length > 1 ? "them" : "it"}, plus ${b.facts} imported fact(s)`
      : `${b.facts} imported fact(s)`;
    if (!window.confirm(`Roll back "${b.filename}"?\n\nThis permanently deletes ${what}. It cannot be undone.`)) return;
    run(b.id, () => rollbackBatch(b.id), (r) => {
      if (!r.ok) return setError(r.error);
      if (done?.batchId === b.id) setDone(null);
      startTransition(() => router.refresh());
    });
  };

  const tooBig = !!file && file.size > MAX_BYTES;

  return (
    <div className="flex flex-col gap-4">
      <Card title="New import">
        <div className="flex flex-col gap-5">
          <Step n={1} title="Download the template">
            <p>
              One sheet per kind of data, with example rows for a fictional institution and a README listing every column,
              allowed value and metric key.
            </p>
            <a href="/api/import/template" download className={`${secondary} mt-2 inline-block`}>
              Download template (.xlsx)
            </a>
          </Step>

          <Step n={2} title="Choose the filled file">
            <p>.xlsx with the template sheets, or .csv containing Facts only for institutions that already exist. Up to 900 KB.</p>
            <input
              ref={input}
              type="file"
              accept=".xlsx,.csv"
              aria-label="Import file"
              onChange={(e) => choose(e.target.files?.[0] ?? null)}
              className="mt-2 block text-sm text-ink file:mr-3 file:rounded-md file:border file:border-line file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink"
            />
          </Step>

          <Step n={3} title="Preview">
            <p>Nothing is written at this step. The file is checked and each rejected row is listed with its reason.</p>
            <button type="button" onClick={onPreview} disabled={!file || tooBig || busy !== null} className={`${secondary} mt-2`}>
              {busy === "preview" ? "Checking…" : "Preview"}
            </button>
          </Step>

          {error ? (
            <p role="alert" className="rounded-md border border-critical/40 bg-critical/5 px-3 py-2 text-sm text-critical">
              {error}
            </p>
          ) : null}

          {preview ? (
            <div className="flex flex-col gap-4 border-t border-line pt-4">
              <div>
                <div className="text-sm font-semibold text-ink">
                  {preview.filename}: <span className="tnum">{preview.accepted}</span> row(s) accepted,{" "}
                  <span className={`tnum ${preview.rejectedTotal ? "text-critical" : ""}`}>{preview.rejectedTotal}</span> rejected
                </div>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full max-w-md border-collapse">
                    <thead>
                      <tr>
                        <Th>Sheet</Th>
                        <Th num>Accepted</Th>
                        <Th num>Rejected</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {SHEET_ORDER.map((s) => (
                        <tr key={s}>
                          <Td>{s}</Td>
                          <Td num>{preview.counts[s].accepted}</Td>
                          <Td num className={preview.counts[s].rejected ? "text-critical" : ""}>
                            {preview.counts[s].rejected}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {preview.newInstitutions.length ? (
                  <p className="mt-2 text-sm text-muted">
                    New institution(s) to be created:{" "}
                    <span className="text-ink">
                      {preview.newInstitutions.map((i) => `${i.name} (${i.aisheCode}), ${i.city}`).join("; ")}
                    </span>
                  </p>
                ) : null}
                {preview.warnings.map((w) => (
                  <p key={w} className="mt-1 text-sm text-attention">
                    {w}
                  </p>
                ))}
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted">Rejected rows</div>
                {preview.rejectedTotal === 0 ? (
                  <p className="mt-1 text-sm text-muted">No rows were rejected.</p>
                ) : (
                  <>
                    <div className="mt-1 max-h-80 overflow-auto rounded-md border border-line">
                      <table className="w-full border-collapse">
                        <thead className="sticky top-0 bg-surface">
                          <tr>
                            <Th>Sheet</Th>
                            <Th num>Row</Th>
                            <Th>Reason</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.rejected.map((r, i) => (
                            <tr key={`${r.sheet}-${r.row}-${i}`}>
                              <Td className="whitespace-nowrap">{r.sheet}</Td>
                              <Td num>{r.row}</Td>
                              <Td>{r.reason}</Td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {preview.rejectedTotal > preview.rejected.length ? (
                      <p className="mt-1 text-xs text-muted">
                        Showing the first {preview.rejected.length} of {preview.rejectedTotal} rejected rows.
                      </p>
                    ) : null}
                  </>
                )}
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Accepted facts (first {preview.factSample.length} of {preview.counts.Facts.accepted})
                </div>
                {preview.factSample.length === 0 ? (
                  <p className="mt-1 text-sm text-muted">No facts were accepted.</p>
                ) : (
                  <div className="mt-1 overflow-x-auto rounded-md border border-line">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <Th num>Row</Th>
                          <Th>Institution</Th>
                          <Th>Metric</Th>
                          <Th>Period</Th>
                          <Th num>Value</Th>
                          <Th>Source</Th>
                          <Th>As of</Th>
                          <Th>Status</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.factSample.map((f) => (
                          <tr key={f.row}>
                            <Td num>{f.row}</Td>
                            <Td className="whitespace-nowrap">{f.aisheCode}</Td>
                            <Td>
                              {metric(f.metricKey)?.label ?? f.metricKey}
                              {f.programme ? <span className="text-muted"> · {f.programme}</span> : null}
                            </Td>
                            <Td className="whitespace-nowrap">{f.period}</Td>
                            <Td num className={f.status === "UNAVAILABLE" ? "text-unavailable" : ""}>
                              {factValue(f)}
                            </Td>
                            <Td>
                              <SourceBadge type={f.sourceType} /> <span className="text-muted">{f.sourceName}</span>
                            </Td>
                            <Td className="whitespace-nowrap">{fmtDate(f.asOfDate)}</Td>
                            <Td>
                              <StatusBadge status={f.status} />
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          <Step n={4} title="Commit">
            {preview ? (
              preview.accepted === 0 ? (
                <p>No rows were accepted, so there is nothing to commit. Fix the rejected rows and preview again.</p>
              ) : preview.rejectedTotal > 0 ? (
                <p>
                  <span className="font-medium text-ink">
                    {preview.rejectedTotal} rejected row(s) will be skipped and not imported.
                  </span>{" "}
                  Only the {preview.accepted} accepted row(s) are written. To include the rest, fix the file and preview again
                  before committing.
                </p>
              ) : (
                <p>All {preview.accepted} row(s) passed and will be written as one batch.</p>
              )
            ) : (
              <p>Preview a file first. Rejected rows are skipped; only accepted rows are written.</p>
            )}
            <button
              type="button"
              onClick={onCommit}
              disabled={!preview || preview.accepted === 0 || busy !== null}
              className={`${primary} mt-2`}
            >
              {busy === "commit" ? "Importing…" : preview?.accepted ? `Commit ${preview.accepted} row(s)` : "Commit"}
            </button>
          </Step>

          {done ? (
            <div role="status" className="rounded-md border border-verified/40 bg-verified/5 px-3 py-2 text-sm text-ink">
              <div className="font-semibold text-verified">Import complete</div>
              <p className="mt-0.5">
                <span className="tnum">{done.accepted}</span> row(s) written
                {done.rejected ? (
                  <>
                    , <span className="tnum">{done.rejected}</span> rejected row(s) skipped
                  </>
                ) : null}
                : {done.counts.institutions} institution(s), {done.counts.programmes} programme(s), {done.counts.facts} fact(s),{" "}
                {done.counts.promoters} promoter(s), {done.counts.legal} legal record(s), {done.counts.recruiters} recruiter(s).
              </p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {done.institutions.map((i) => (
                  <li key={i.id}>
                    <Link href={`/institutions/${i.id}`} className="font-medium text-brand hover:underline">
                      {i.name}
                    </Link>{" "}
                    <span className="text-muted">
                      {i.aisheCode} · {i.created ? "new" : "existing, data added"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </Card>

      <Card title="Past imports">
        {batches.length === 0 ? (
          <Empty>No imports yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <Th>File</Th>
                  <Th>Imported</Th>
                  <Th num>Accepted</Th>
                  <Th num>Rejected</Th>
                  <Th>Institutions created</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id}>
                    <Td>{b.filename}</Td>
                    <Td className="whitespace-nowrap">{fmtDate(b.createdAt)}</Td>
                    <Td num>{b.accepted}</Td>
                    <Td num>{b.rejected}</Td>
                    <Td>
                      {b.institutions.length ? (
                        b.institutions.map((i, n) => (
                          <span key={i.id}>
                            {n ? ", " : ""}
                            <Link href={`/institutions/${i.id}`} className="text-brand hover:underline">
                              {i.name}
                            </Link>
                          </span>
                        ))
                      ) : (
                        <span className="text-muted">None (data added to existing institutions)</span>
                      )}
                    </Td>
                    <Td className="text-right">
                      <button type="button" onClick={() => onRollback(b)} disabled={busy !== null} className={`${secondary} text-critical`}>
                        {busy === b.id ? "Rolling back…" : "Roll back"}
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-muted">
          Roll back deletes the institutions a batch created, with everything recorded under them, and every fact the batch
          imported. Limitation: programmes, promoters, legal records and recruiters that a batch added to an institution that
          already existed are not linked to the batch and stay in place after a roll back.
        </p>
      </Card>
    </div>
  );
}
