"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type DragEvent, type ReactNode } from "react";
import { commitImportAction, previewImport, rollbackBatch } from "@/app/import/actions";
import { SOURCE_LABEL, STATUS_LABEL, metric } from "@/lib/metrics";
import { Empty, Td, Th } from "@/components/ui";
import { StatusMark } from "@/components/FactLedger";
import { fmtDate, fmtNum } from "@/lib/facts";
import type { CommitResult } from "@/lib/import/commit";
import type { ImportPreview } from "@/lib/import/parse";
import type { FactRow, SheetName } from "@/lib/import/schemas";

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

const btn =
  "inline-flex h-10 items-center sm:h-9 justify-center gap-2 rounded-md px-3.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40";
const primary = `${btn} bg-ink text-canvas hover:opacity-90`;
const secondary = `${btn} border border-line-strong bg-surface text-ink hover:bg-sunken`;
const ghost = `${btn} text-muted hover:bg-sunken hover:text-ink`;

const STEPS = ["Template", "Upload", "Review", "Commit"];

function factValue(f: FactRow): string {
  if (f.status === "UNAVAILABLE") return "Not available";
  const unit = metric(f.metricKey)?.unit ?? "count";
  if (unit === "date" && f.valueText) return fmtDate(f.valueText);
  if (f.valueNum !== null) return fmtNum(f.valueNum, unit);
  return f.valueText ?? "Not available";
}

const kb = (n: number) => `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;

function Step({ n, title, note, children }: { n: number; title: string; note: ReactNode; children: ReactNode }) {
  return (
    <section className="grid gap-x-10 gap-y-4 border-t border-line py-8 md:grid-cols-[210px_minmax(0,1fr)]">
      <div>
        <div className="font-mono text-[11px] text-faint">0{n}</div>
        <h2 className="display mt-1 text-[22px] font-medium leading-tight text-ink">{title}</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{note}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function Notice({ tone, role, children }: { tone: "critical" | "verified"; role: "alert" | "status"; children: ReactNode }) {
  return (
    <div role={role} className="relative py-1 pl-4 text-[13.5px] text-ink">
      <span aria-hidden className={`absolute bottom-1 left-0 top-1 w-[3px] rounded-full ${tone === "critical" ? "bg-critical" : "bg-verified"}`} />
      {children}
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
  const [errAt, setErrAt] = useState<"import" | "history">("import");
  const [busy, setBusy] = useState<"preview" | "commit" | string | null>(null);
  const [drag, setDrag] = useState(false);
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
    setErrAt("import");
    setError(f && f.size > MAX_BYTES ? "The file is larger than 900 KB. Split it and import in parts." : null);
  };

  const run = async <T,>(kind: string, action: () => Promise<T>, then: (r: T) => void) => {
    setBusy(kind);
    setErrAt(kind === "preview" || kind === "commit" ? "import" : "history");
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

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (input.current) input.current.value = "";
    choose(f);
  };

  const tooBig = !!file && file.size > MAX_BYTES;
  // Step 1 is optional, so the flow starts at Upload.
  const stage = done ? 5 : preview ? 4 : file ? 3 : 2;
  const importError = error && errAt === "import" ? <Notice tone="critical" role="alert">{error}</Notice> : null;

  return (
    <div className="mt-8">
      <ol className="grid grid-cols-4 gap-x-2 sm:gap-x-3" aria-label="Import steps">
        {STEPS.map((s, i) => {
          const n = i + 1;
          const state = n === 1 ? "ready" : n < stage ? "done" : n === stage ? "current" : "todo";
          return (
            <li key={s} aria-current={state === "current" ? "step" : undefined}>
              <div className={`h-[2px] ${state === "todo" ? "bg-line" : state === "ready" ? "bg-line-strong" : "bg-ink"}`} />
              <div className="mt-2 flex items-baseline gap-2">
                <span className="hidden font-mono text-[11px] text-faint sm:inline">0{n}</span>
                <span className={`text-[12.5px] sm:text-[13px] ${state === "current" ? "font-medium text-ink" : state === "done" ? "text-ink" : "text-muted"}`}>
                  {s}
                </span>
                {state === "done" ? (
                  <svg viewBox="0 0 12 12" width="11" height="11" aria-label="done" className="text-verified">
                    <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-8">
        <Step
          n={1}
          title="Template"
          note="One sheet per kind of data, example rows for a fictional institution, and a README of every column, allowed value and metric key."
        >
          <a href="/api/import/template" download className={secondary}>
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Download template (.xlsx)
          </a>
        </Step>

        <Step
          n={2}
          title="Upload"
          note=".xlsx with the template sheets, or .csv of Facts for institutions that already exist. Up to 900 KB."
        >
          <label
            htmlFor="import-file"
            onDragEnter={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDrag(false);
            }}
            onDrop={onDrop}
            className={`flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-[1.5px] border-dashed px-6 py-10 text-center transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand ${
              drag ? "border-ink bg-sunken" : file ? "border-line-strong bg-surface" : "border-line-strong hover:border-ink hover:bg-sunken"
            }`}
          >
            <input
              id="import-file"
              ref={input}
              type="file"
              accept=".xlsx,.csv"
              aria-label="Import file"
              onChange={(e) => choose(e.target.files?.[0] ?? null)}
              className="sr-only"
            />
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.3" className="text-faint">
              {file ? (
                <path d="M6 3h8l4 4v14H6zM14 3v4h4M9 13l2 2 4-4.5" strokeLinejoin="round" strokeLinecap="round" />
              ) : (
                <path d="M12 16V4M7.5 8.5 12 4l4.5 4.5M4 15v5h16v-5" strokeLinejoin="round" strokeLinecap="round" />
              )}
            </svg>
            {file ? (
              <>
                <span className="display break-all text-[20px] leading-tight text-ink">{file.name}</span>
                <span className="font-mono text-[11.5px] text-muted">
                  <span className={tooBig ? "text-critical" : ""}>{kb(file.size)}</span> · drop or click to replace
                </span>
              </>
            ) : (
              <>
                <span className="display text-[20px] leading-tight text-ink">
                  {drag ? "Release to add the file" : "Drop the filled file here"}
                </span>
                <span className="text-[13px] text-muted">or click to choose from your computer</span>
              </>
            )}
          </label>
          {file ? (
            <button
              type="button"
              onClick={() => {
                if (input.current) input.current.value = "";
                choose(null);
              }}
              className={`${ghost} -ml-3.5 mt-2`}
            >
              Remove file
            </button>
          ) : null}
        </Step>

        <Step n={3} title="Review" note="Nothing is written at this step. Each rejected row is listed with its reason.">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={onPreview} disabled={!file || tooBig || busy !== null} className={preview ? secondary : primary}>
              {busy === "preview" ? "Checking…" : preview ? "Check again" : "Check file"}
            </button>
            {!file && !preview ? <span className="text-[13px] text-faint">Upload a file first.</span> : null}
          </div>

          {importError && stage <= 3 ? <div className="mt-5">{importError}</div> : null}

          {preview ? (
            <div className="mt-7 space-y-8">
              <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
                <div>
                  <div className="text-[12px] text-muted">Rows accepted</div>
                  <div className="display tnum mt-1 text-[36px] leading-none text-ink">{preview.accepted}</div>
                </div>
                <div className="border-l border-line pl-6 sm:pl-10">
                  <div className="text-[12px] text-muted">Rows rejected</div>
                  <div className={`display tnum mt-1 text-[36px] leading-none ${preview.rejectedTotal ? "text-critical" : "text-ink"}`}>
                    {preview.rejectedTotal}
                  </div>
                </div>
                <div className="min-w-0 pb-1 font-mono text-[11.5px] text-faint">{preview.filename}</div>
              </div>

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
                      <Td className="font-mono text-[12.5px]">{s}</Td>
                      <Td num>{preview.counts[s].accepted}</Td>
                      <Td num className={preview.counts[s].rejected ? "text-critical" : "text-muted"}>
                        {preview.counts[s].rejected}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {preview.newInstitutions.length || preview.warnings.length ? (
                <div className="space-y-1.5 text-[13px]">
                  {preview.newInstitutions.length ? (
                    <p className="text-muted">
                      New institution(s) to be created:{" "}
                      <span className="text-ink">
                        {preview.newInstitutions.map((i) => `${i.name} (${i.aisheCode}), ${i.city}`).join("; ")}
                      </span>
                    </p>
                  ) : null}
                  {preview.warnings.map((w) => (
                    <p key={w} className="text-attention">
                      {w}
                    </p>
                  ))}
                </div>
              ) : null}

              <div>
                <h3 className="text-[14px] font-medium text-ink">Rejected rows</h3>
                {preview.rejectedTotal === 0 ? (
                  <p className="mt-1 text-[13px] text-muted">No rows were rejected.</p>
                ) : (
                  <>
                    <div className="mt-2 max-h-80 overflow-auto">
                      <table className="w-full border-collapse">
                        <thead className="sticky top-0 bg-canvas">
                          <tr>
                            <Th>Sheet</Th>
                            <Th num>Row</Th>
                            <Th>Reason</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.rejected.map((r, i) => (
                            <tr key={`${r.sheet}-${r.row}-${i}`} className="hover:bg-sunken">
                              <Td className="whitespace-nowrap font-mono text-[12.5px]">{r.sheet}</Td>
                              <Td num>{r.row}</Td>
                              <Td>{r.reason}</Td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {preview.rejectedTotal > preview.rejected.length ? (
                      <p className="mt-1.5 text-[12px] text-muted">
                        Showing the first {preview.rejected.length} of {preview.rejectedTotal} rejected rows.
                      </p>
                    ) : null}
                  </>
                )}
              </div>

              <div>
                <h3 className="text-[14px] font-medium text-ink">
                  Accepted facts{" "}
                  <span className="font-normal text-muted">
                    first {preview.factSample.length} of {preview.counts.Facts.accepted}
                  </span>
                </h3>
                {preview.factSample.length === 0 ? (
                  <p className="mt-1 text-[13px] text-muted">No facts were accepted.</p>
                ) : (
                  <>
                  <ul className="mt-2 divide-y divide-line border-y border-line sm:hidden">
                    {preview.factSample.map((f) => (
                      <li key={f.row} className="py-2.5">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="min-w-0 text-[13px] text-ink">
                            {metric(f.metricKey)?.label ?? f.metricKey}
                            {f.programme ? <span className="text-muted"> · {f.programme}</span> : null}
                          </span>
                          <span className={`tnum shrink-0 text-right text-[14px] ${f.status === "UNAVAILABLE" ? "text-unavailable" : "text-ink"}`}>
                            {factValue(f)}
                          </span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-muted">
                          <span className="font-mono text-[11px]">Row {f.row} · {f.aisheCode} · {f.period}</span>
                          <span className="inline-flex items-center gap-1.5">
                            <StatusMark status={f.status} />
                            {STATUS_LABEL[f.status]}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[12px] text-faint">
                          {SOURCE_LABEL[f.sourceType]} · {f.sourceName} · <span className="font-mono text-[11px]">{fmtDate(f.asOfDate)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 hidden overflow-x-auto sm:block">
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
                          <tr key={f.row} className="align-baseline hover:bg-sunken">
                            <Td num className="text-muted">{f.row}</Td>
                            <Td className="whitespace-nowrap font-mono text-[12.5px]">{f.aisheCode}</Td>
                            <Td>
                              {metric(f.metricKey)?.label ?? f.metricKey}
                              {f.programme ? <span className="text-muted"> · {f.programme}</span> : null}
                            </Td>
                            <Td className="whitespace-nowrap font-mono text-[12.5px] text-muted">{f.period}</Td>
                            <Td num className={f.status === "UNAVAILABLE" ? "text-unavailable" : ""}>
                              {factValue(f)}
                            </Td>
                            <Td>
                              <div>{SOURCE_LABEL[f.sourceType]}</div>
                              <div className="text-[12px] text-muted">{f.sourceName}</div>
                            </Td>
                            <Td className="whitespace-nowrap font-mono text-[12.5px] text-muted">{fmtDate(f.asOfDate)}</Td>
                            <Td className="whitespace-nowrap">
                              <span className="inline-flex items-center gap-1.5 text-[12.5px]">
                                <StatusMark status={f.status} />
                                {STATUS_LABEL[f.status]}
                              </span>
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  </>
                )}
              </div>
            </div>
          ) : null}
        </Step>

        <Step n={4} title="Commit" note="Accepted rows are written as one batch, which can be rolled back below.">
          <div className="max-w-xl text-[13.5px] leading-relaxed text-muted">
            {preview ? (
              preview.accepted === 0 ? (
                <p>No rows were accepted, so there is nothing to commit. Fix the rejected rows and check again.</p>
              ) : preview.rejectedTotal > 0 ? (
                <p>
                  <span className="font-medium text-ink">
                    {preview.rejectedTotal} rejected row(s) will be skipped and not imported.
                  </span>{" "}
                  Only the {preview.accepted} accepted row(s) are written. To include the rest, fix the file and check again
                  before committing.
                </p>
              ) : (
                <p>All {preview.accepted} row(s) passed and will be written as one batch.</p>
              )
            ) : (
              <p>Check a file first. Rejected rows are skipped; only accepted rows are written.</p>
            )}
          </div>
          <button
            type="button"
            onClick={onCommit}
            disabled={!preview || preview.accepted === 0 || busy !== null}
            className={`${primary} mt-4`}
          >
            {busy === "commit" ? "Importing…" : preview?.accepted ? `Commit ${preview.accepted} row(s)` : "Commit"}
          </button>

          {importError && stage > 3 ? <div className="mt-5">{importError}</div> : null}

          {done ? (
            <div className="mt-6">
              <Notice tone="verified" role="status">
                <div className="font-medium text-verified">Import complete</div>
                <p className="mt-0.5 text-muted">
                  <span className="tnum text-ink">{done.accepted}</span> row(s) written
                  {done.rejected ? (
                    <>
                      , <span className="tnum text-ink">{done.rejected}</span> rejected row(s) skipped
                    </>
                  ) : null}
                  : {done.counts.institutions} institution(s), {done.counts.programmes} programme(s), {done.counts.facts}{" "}
                  fact(s), {done.counts.promoters} promoter(s), {done.counts.legal} legal record(s), {done.counts.recruiters}{" "}
                  recruiter(s).
                </p>
                <ul className="mt-2 flex flex-col gap-1">
                  {done.institutions.map((i) => (
                    <li key={i.id}>
                      <Link href={`/institutions/${i.id}`} className="font-medium text-brand hover:underline">
                        {i.name}
                      </Link>{" "}
                      <span className="font-mono text-[11.5px] text-faint">
                        {i.aisheCode} · {i.created ? "new" : "existing, data added"}
                      </span>
                    </li>
                  ))}
                </ul>
              </Notice>
            </div>
          ) : null}
        </Step>
      </div>

      <section className="mt-6 border-t-2 border-ink pt-3">
        <header className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="display text-xl font-medium text-ink">Past imports</h2>
          <span className="tnum text-[13px] text-muted">
            {batches.length} batch{batches.length === 1 ? "" : "es"}
          </span>
        </header>
        {error && errAt === "history" ? (
          <div className="mb-4">
            <Notice tone="critical" role="alert">
              {error}
            </Notice>
          </div>
        ) : null}
        {batches.length === 0 ? (
          <Empty>No imports yet.</Empty>
        ) : (
          <>
          <ul className="divide-y divide-line border-y border-line sm:hidden">
            {batches.map((b) => (
              <li key={b.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="break-all font-mono text-[12.5px] text-ink">{b.filename}</div>
                    <div className="mt-0.5 text-[12px] text-muted">
                      <span className="font-mono text-[11px]">{fmtDate(b.createdAt)}</span> ·{" "}
                      <span className="tnum text-ink">{b.accepted}</span> accepted ·{" "}
                      <span className={`tnum ${b.rejected ? "text-ink" : ""}`}>{b.rejected}</span> rejected
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRollback(b)}
                    disabled={busy !== null}
                    className="min-h-[40px] shrink-0 rounded px-2 text-[13px] text-critical hover:bg-critical/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {busy === b.id ? "Rolling back…" : "Roll back"}
                  </button>
                </div>
                <div className="mt-1 text-[12.5px]">
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
                    <span className="text-muted">None, data added to existing institutions</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <Th>File</Th>
                  <Th>Imported</Th>
                  <Th num>Accepted</Th>
                  <Th num>Rejected</Th>
                  <Th>Institutions created</Th>
                  <Th>
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className="align-baseline hover:bg-sunken">
                    <Td className="font-mono text-[12.5px]">{b.filename}</Td>
                    <Td className="whitespace-nowrap font-mono text-[12.5px] text-muted">{fmtDate(b.createdAt)}</Td>
                    <Td num>{b.accepted}</Td>
                    <Td num className={b.rejected ? "" : "text-muted"}>
                      {b.rejected}
                    </Td>
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
                        <span className="text-muted">None, data added to existing institutions</span>
                      )}
                    </Td>
                    <Td className="text-right">
                      <button
                        type="button"
                        onClick={() => onRollback(b)}
                        disabled={busy !== null}
                        className="rounded px-2 py-1 text-[13px] text-critical hover:bg-critical/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {busy === b.id ? "Rolling back…" : "Roll back"}
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
        <p className="mt-3 max-w-3xl text-[12px] leading-relaxed text-faint">
          Roll back deletes the institutions a batch created, everything recorded under them, and every fact it imported.
          Programmes, promoters, legal records and recruiters a batch added to an institution that already existed are not
          linked to the batch and stay in place.
        </p>
      </section>
    </div>
  );
}
