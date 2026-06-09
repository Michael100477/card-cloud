"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Props {
  labelUrl: string;
  tracking: string;
}

/**
 * Print page that lays the 4×6 USPS label on the BOTTOM half of a letter
 * sheet in LANDSCAPE orientation. EasyPost returns a 4-wide × 6-tall PNG;
 * we rotate it 90° so the long dimension is horizontal — that matches how
 * label sticker paper is perforated (sticky portion is the bottom half,
 * wide side along the long edge).
 *
 * The on-screen view shows the label exactly as it will print, so what
 * you see is what comes out of the printer.
 *
 * This route sits OUTSIDE /admin/ so it doesn't inherit the admin sidebar
 * layout — the print preview is clean.
 */
export function PrintLabelClient({ labelUrl, tracking }: Props) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [autoPrint, setAutoPrint] = useState(true);

  useEffect(() => {
    if (imgLoaded && autoPrint) {
      const t = setTimeout(() => window.print(), 300);
      return () => clearTimeout(t);
    }
  }, [imgLoaded, autoPrint]);

  if (!labelUrl) {
    return (
      <div className="p-8">
        <p className="text-red-600">No label URL provided.</p>
        <Link href="/admin/shipping" className="text-brand text-sm hover:underline">← Back to Shipping</Link>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @page { size: letter; margin: 0; }

        @media screen {
          body { background: #f1f5f9; margin: 0; }
        }
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            width: 8.5in;
            height: 11in;
            overflow: hidden;
          }
          .no-print { display: none !important; }
          /* Force the print page to occupy the full sheet and clip anything
             outside (e.g., the rotated label image whose CSS bounding box
             extends past the container — that overflow was causing the
             browser to add a second blank page). */
          .print-page {
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            overflow: hidden !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
          }
        }

        .print-page {
          width: 8.5in;
          height: 11in;
          position: relative;
          background: white;
          margin: 0 auto;
          overflow: hidden;
        }
        @media screen {
          .print-page {
            margin: 24px auto;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            border: 1px solid #e5e7eb;
          }
        }

        /* The container holds the rotated 4x6 image (visually 6 wide x 4
           tall). Positioned at the TOP of the digital page — Mike's label
           paper enters the printer with the sticky portion leading, so the
           "top" of the page in the print preview corresponds to the sticky
           bottom of the paper when held normally. If your printer feeds
           differently, swap the "top" rule for "bottom" below. */
        .label-area {
          position: absolute;
          top: 0.75in;
          left: 50%;
          transform: translateX(-50%);
          width:  6in;
          height: 4in;
        }
        /* The image is absolutely positioned inside .label-area so its 4×6
           CSS bounding box doesn't influence parent layout — only its
           rendered pixels (which fit inside the 6×4 area after rotation). */
        .label-img {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 4in;
          height: 6in;
          transform: translate(-50%, -50%) rotate(90deg);
          transform-origin: center center;
        }
      `}</style>

      {/* On-screen controls (hidden when printing) */}
      <div className="no-print" style={{
        background: "white",
        padding: "16px 32px",
        borderBottom: "1px solid #e5e7eb",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/admin/shipping" style={{ color: "#3b82f6", fontSize: 14, textDecoration: "none" }}>
            ← Shipping
          </Link>
          {tracking && (
            <span style={{ color: "#64748b", fontSize: 14 }}>
              Tracking: <code style={{ color: "#0f172a" }}>{tracking}</code>
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <label style={{ color: "#64748b", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={autoPrint} onChange={e => setAutoPrint(e.target.checked)} />
            Auto-open print dialog
          </label>
          <button onClick={() => window.print()} style={{
            background: "#3b82f6",
            color: "white",
            fontSize: 14,
            fontWeight: 600,
            padding: "8px 20px",
            borderRadius: 12,
            border: "none",
            cursor: "pointer",
          }}>
            Print
          </button>
        </div>
      </div>

      <div className="print-page">
        <div className="label-area">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={labelUrl}
            alt="Shipping label"
            className="label-img"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgLoaded(true)}
          />
        </div>
      </div>
    </>
  );
}
