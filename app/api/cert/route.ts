import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { lookupCert } from "@/lib/graders";
import { detectGraderFromCert } from "@/lib/ocr";

// Direct cert-number lookup — no OCR needed.
// Used by the manual entry path in SlabScanner.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const certNumber = req.nextUrl.searchParams.get("cert")?.trim();
  const grader     = req.nextUrl.searchParams.get("grader")?.trim();

  if (!certNumber) {
    return NextResponse.json({ error: "cert parameter is required." }, { status: 400 });
  }

  const resolvedGrader = grader ?? detectGraderFromCert(certNumber);
  const cardData = await lookupCert(certNumber, resolvedGrader);

  return NextResponse.json({
    success:    true,
    certNumber,
    grader:     resolvedGrader,
    cardData,
  });
}
