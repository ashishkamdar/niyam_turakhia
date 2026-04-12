import { NextResponse } from "next/server";

/**
 * GET /api/parties/template
 *
 * Downloads a blank CSV template for the party bulk-upload flow.
 * The header row matches what POST /api/parties/upload expects.
 * The second row is a sample to show the expected format.
 */
export async function GET() {
  const header = "Name,Short Code,Type,Location,SBS Party Code,OroSoft Party Code,Aliases,Phone,Email,Notes";
  const sample =
    "Tak Fung Trading Ltd,TAKFUNG,both,hong_kong,TF001,ORO-TF-001,TAK FUNG;TF TRADING,+852-1234-5678,tf@example.com,Gold specialist — HK based";
  const body = header + "\r\n" + sample + "\r\n";

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="prismx-party-template.csv"',
      "Cache-Control": "no-store",
    },
  });
}
