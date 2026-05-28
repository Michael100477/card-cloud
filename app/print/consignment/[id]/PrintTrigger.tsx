"use client";

import { useEffect } from "react";

export function PrintTrigger() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 500);
    return () => clearTimeout(t);
  }, []);
  return null;
}

export function PrintBar({ orderId }: { orderId: string }) {
  return (
    <div className="print:hidden bg-navy text-white px-6 py-3 flex items-center justify-between">
      <p className="text-sm">This is your packing slip — include it in your package so we can identify your shipment.</p>
      <div className="flex gap-3">
        <button
          onClick={() => window.print()}
          className="bg-amber text-amber-dark text-sm font-semibold px-4 py-1.5 rounded-lg hover:brightness-105"
        >
          Print
        </button>
        <a href={`/dashboard/consignments/${orderId}`} className="text-white/60 hover:text-white text-sm">
          ← Back to order
        </a>
      </div>
    </div>
  );
}
