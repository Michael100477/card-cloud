import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

async function getCardCloudAddress() {
  const rows = await db.siteSetting.findMany({
    where: { key: { in: ["trade_ship_name", "trade_ship_street1", "trade_ship_street2", "trade_ship_city", "trade_ship_state", "trade_ship_postal"] } },
  });
  const m = new Map(rows.map(r => [r.key, r.value]));
  return {
    name:    m.get("trade_ship_name") || "The Card Cloud — Trade Desk",
    street1: m.get("trade_ship_street1") || "[Address not configured]",
    street2: m.get("trade_ship_street2") || "",
    city:    m.get("trade_ship_city")    || "",
    state:   m.get("trade_ship_state")   || "",
    postal:  m.get("trade_ship_postal")  || "",
  };
}

export default async function PackingSlipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const myId = session.user.id;

  const trade = await db.trade.findUnique({
    where: { id },
    include: {
      initiator: { select: { id: true, displayName: true, username: true, email: true } },
      target:    { select: { id: true, displayName: true, username: true, email: true } },
    },
  });
  if (!trade) notFound();
  if (trade.initiatorId !== myId && trade.targetId !== myId) redirect("/trades/my");
  // Only meaningful after both sides accepted
  if (!["accepted", "inbound", "received_both"].includes(trade.status)) {
    redirect(`/trades/${id}`);
  }

  const iAmInitiator = trade.initiatorId === myId;
  const mySide       = iAmInitiator ? "initiator" : "target";
  const me           = iAmInitiator ? trade.initiator : trade.target;
  const them         = iAmInitiator ? trade.target    : trade.initiator;

  // Cards I'm sending (my side of the current revision)
  const myCards = trade.currentRevisionId
    ? await db.tradeRevisionCard.findMany({
        where: { revisionId: trade.currentRevisionId, side: mySide },
        include: { card: { select: { id: true, player: true, year: true, manufacturer: true, set: true, cardNumber: true, grade: true, gradeCompany: true } } },
      })
    : [];

  const address  = await getCardCloudAddress();

  // QR code points to the admin trade-receive page with a side parameter.
  // Scanning brings the admin straight to the verification view.
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3001";
  const qrTarget = `${baseUrl}/admin/trades/${trade.id}/receive?side=${mySide}`;
  const qrDataUrl = await QRCode.toDataURL(qrTarget, { width: 220, margin: 1 });

  const myName    = me.displayName ?? me.username ?? me.email ?? "Trader";
  const theirName = them.displayName ?? them.username ?? them.email ?? "Trader";

  return (
    <div className="bg-white min-h-screen p-8 print:p-0">
      {/* Print button — hidden when printing */}
      <div className="max-w-3xl mx-auto mb-6 flex items-center justify-between print:hidden">
        <a href={`/trades/${trade.id}`} className="text-slate-400 text-sm hover:text-navy">← Back to trade</a>
        <button onClick={undefined} className="bg-purple-600 text-white text-sm font-semibold px-5 py-2 rounded-xl hover:bg-purple-700" id="printBtn">
          🖨 Print packing slip
        </button>
      </div>

      {/* The slip itself */}
      <div className="max-w-3xl mx-auto bg-white border-2 border-slate-200 rounded-2xl p-8 print:border-0 print:rounded-none">
        {/* Header */}
        <div className="flex justify-between items-start mb-6 pb-4 border-b border-slate-200">
          <div>
            <p className="text-purple-600 text-xs font-bold tracking-widest mb-1">PACKING SLIP</p>
            <h1 className="text-2xl font-bold text-navy">Trade #{trade.id.slice(-8).toUpperCase()}</h1>
            <p className="text-slate-500 text-sm mt-1">Generated {new Date().toLocaleString()}</p>
          </div>
          <img src={qrDataUrl} alt="QR code" className="w-32 h-32" />
        </div>

        {/* Addresses */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <p className="text-slate-400 text-xs uppercase tracking-widest font-semibold mb-2">From</p>
            <p className="text-navy font-medium text-sm">{myName}</p>
            <p className="text-slate-500 text-sm">{me.email}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs uppercase tracking-widest font-semibold mb-2">Ship to</p>
            <p className="text-navy font-bold text-sm">{address.name}</p>
            <p className="text-navy text-sm">{address.street1}</p>
            {address.street2 && <p className="text-navy text-sm">{address.street2}</p>}
            <p className="text-navy text-sm">{address.city}, {address.state} {address.postal}</p>
          </div>
        </div>

        {/* Trade summary */}
        <div className="bg-slate-50 rounded-xl p-4 mb-6">
          <p className="text-slate-400 text-xs uppercase tracking-widest font-semibold mb-1">Trade summary</p>
          <p className="text-navy text-sm">
            <span className="font-semibold">{myName}</span> is trading {myCards.length} card{myCards.length === 1 ? "" : "s"} for {""}
            <span className="font-semibold">{theirName}</span>&apos;s cards.
          </p>
        </div>

        {/* Cards in this shipment */}
        <div className="mb-6">
          <p className="text-slate-400 text-xs uppercase tracking-widest font-semibold mb-3">Cards in this shipment ({myCards.length})</p>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-slate-400 text-xs uppercase tracking-wide border-b border-slate-200">
                <th className="pb-2">Player</th>
                <th className="pb-2">Year</th>
                <th className="pb-2">Set</th>
                <th className="pb-2">Card #</th>
                <th className="pb-2">Grade</th>
              </tr>
            </thead>
            <tbody>
              {myCards.map(c => (
                <tr key={c.cardId} className="border-b border-slate-100">
                  <td className="py-2 text-navy font-medium">{c.card.player}</td>
                  <td className="py-2 text-slate-500">{c.card.year}</td>
                  <td className="py-2 text-slate-500">{c.card.manufacturer} {c.card.set}</td>
                  <td className="py-2 text-slate-500">{c.card.cardNumber ?? "—"}</td>
                  <td className="py-2 text-slate-500">{c.card.grade ? `${c.card.gradeCompany} ${c.card.grade}` : "Raw"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Instructions */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900">
          <p className="font-semibold mb-1.5">Shipping instructions</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>Include this packing slip inside the package.</li>
            <li>Use a tracked, insured shipping method.</li>
            <li>Pack cards securely in penny sleeves + toploaders (or original slabs if graded) inside a bubble mailer.</li>
            <li>After mailing, enter your tracking number on the trade page so the other party can follow your shipment.</li>
            <li>The Card Cloud will verify receipt and forward the cards to <span className="font-semibold">{theirName}</span>.</li>
          </ol>
        </div>
      </div>

      {/* Auto-trigger print on a button click */}
      <script dangerouslySetInnerHTML={{ __html: `
        document.getElementById("printBtn").addEventListener("click", () => window.print());
      ` }} />

      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          .print\\:p-0 { padding: 0 !important; }
          .print\\:border-0 { border: 0 !important; }
          .print\\:rounded-none { border-radius: 0 !important; }
        }
      `}</style>
    </div>
  );
}
