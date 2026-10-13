import { NextResponse } from "next/server";
import { searchInstitutions } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return NextResponse.json(await searchInstitutions(q));
}
