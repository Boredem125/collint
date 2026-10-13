"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { commitImport, type CommitResult } from "@/lib/import/commit";
import { parseWorkbook, toPreview, type ImportPreview, type Known, type ParseResult } from "@/lib/import/parse";

export type PreviewState = { ok: true; preview: ImportPreview } | { ok: false; error: string };
export type CommitState = { ok: true; result: CommitResult } | { ok: false; error: string };
export type RollbackState = { ok: true } | { ok: false; error: string };

// Server actions accept about 1 MB per request with the default Next config.
const MAX_BYTES = 900 * 1024;

async function loadKnown(): Promise<Known> {
  const [institutions, programmes, promoters] = await Promise.all([
    prisma.institution.findMany({ select: { aisheCode: true } }),
    prisma.programme.findMany({ select: { name: true, institution: { select: { aisheCode: true } } } }),
    prisma.promoter.findMany({ select: { name: true, institution: { select: { aisheCode: true } } } }),
  ]);
  return {
    institutions: new Set(institutions.map((i) => i.aisheCode)),
    programmes: new Set(programmes.map((p) => `${p.institution.aisheCode}|${p.name}`)),
    promoters: new Set(promoters.map((p) => `${p.institution.aisheCode}|${p.name}`)),
  };
}

async function parseUpload(formData: FormData): Promise<{ parsed: ParseResult } | { error: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a .xlsx or .csv file first." };
  if (file.size > MAX_BYTES) return { error: "The file is larger than 900 KB. Split it and import in parts." };
  const parsed = parseWorkbook(await file.arrayBuffer(), file.name, await loadKnown());
  if (parsed.errors.length) return { error: parsed.errors.join(" ") };
  return { parsed };
}

export async function previewImport(formData: FormData): Promise<PreviewState> {
  try {
    const r = await parseUpload(formData);
    if ("error" in r) return { ok: false, error: r.error };
    return { ok: true, preview: toPreview(r.parsed) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "The file could not be read." };
  }
}

// The file is parsed again here: what gets written never depends on what the browser sent back.
export async function commitImportAction(formData: FormData): Promise<CommitState> {
  try {
    const r = await parseUpload(formData);
    if ("error" in r) return { ok: false, error: r.error };
    const result = await commitImport(r.parsed, r.parsed.filename);
    revalidatePath("/", "layout");
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "The import failed. Nothing was written." };
  }
}

export async function rollbackBatch(batchId: string): Promise<RollbackState> {
  try {
    await prisma.importBatch.delete({ where: { id: batchId } });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch {
    return { ok: false, error: "The batch could not be rolled back. It may already have been removed." };
  }
}
