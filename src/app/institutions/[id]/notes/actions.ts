"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { DEAL_STAGES } from "@/lib/metrics";
import type { DealStage } from "@/lib/types";

export type FormState = { ok: boolean; error?: string; at: number; body?: string; reason?: string };

const STAGE_KEYS = DEAL_STAGES.map((s) => s.key) as [DealStage, ...DealStage[]];
const label = (s: string) => DEAL_STAGES.find((d) => d.key === s)?.label ?? s;

const StageInput = z.object({
  stage: z.enum(STAGE_KEYS, { message: "Choose a stage." }),
  reason: z.string().trim().max(1000, "Keep the reason under 1,000 characters.").optional().default(""),
});

const NoteInput = z.object({
  kind: z.enum(["NOTE", "DECISION"], { message: "Choose note or decision." }),
  body: z.string().trim().min(1, "Write something first.").max(4000, "Notes are limited to 4,000 characters."),
});

function refresh(id: string) {
  revalidatePath(`/institutions/${id}`, "layout");
  revalidatePath("/");
}

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : undefined);

export async function changeStage(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const at = Date.now();
  const parsed = StageInput.safeParse({ stage: str(formData.get("stage")), reason: str(formData.get("reason")) });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message, at, reason: str(formData.get("reason")) };
  const { stage, reason } = parsed.data;
  try {
    const inst = await prisma.institution.findUnique({ where: { id }, select: { stage: true } });
    if (!inst) return { ok: false, error: "Institution not found.", at };
    if (inst.stage === stage) return { ok: false, error: `Already in ${label(stage)}.`, at, reason };
    const body = `Moved from ${label(inst.stage)} to ${label(stage)}` + (reason ? `. ${reason}` : "");
    await prisma.$transaction([
      prisma.institution.update({ where: { id }, data: { stage, stageUpdatedAt: new Date() } }),
      prisma.note.create({ data: { institutionId: id, kind: "STAGE_CHANGE", body } }),
    ]);
  } catch {
    return { ok: false, error: "The stage could not be saved. Try again.", at, reason };
  }
  refresh(id);
  return { ok: true, at };
}

export async function addNote(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const at = Date.now();
  const raw = { kind: str(formData.get("kind")), body: str(formData.get("body")) };
  const parsed = NoteInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message, at, body: raw.body };
  try {
    await prisma.note.create({ data: { institutionId: id, ...parsed.data } });
  } catch {
    return { ok: false, error: "The note could not be saved. Try again.", at, body: raw.body };
  }
  refresh(id);
  return { ok: true, at };
}
