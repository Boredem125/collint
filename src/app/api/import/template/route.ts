import { TEMPLATE_FILENAME, buildTemplate } from "@/lib/import/template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const body = new Uint8Array(buildTemplate());
  return new Response(body, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${TEMPLATE_FILENAME}"`,
      "Content-Length": String(body.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
