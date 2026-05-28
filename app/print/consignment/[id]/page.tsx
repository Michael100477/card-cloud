import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { PrintTrigger, PrintBar } from "./PrintTrigger";
import { generateReceiveToken } from "@/lib/receive-token";
import QRCode from "qrcode";
import { getCommissionRates } from "@/lib/commission";

interface Props { params: Promise<{ id: string }> }

export default async function PackingSlipPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const [order, user, commissionRates] = await Promise.all([
    db.consignmentOrder.findUnique({
      where:   { id },
      include: { items: { orderBy: { id: "asc" } } },
    }),
    db.user.findUnique({
      where:  { id: session.user.id },
      select: {
        fullName: true, displayName: true, username: true, email: true,
        phone: true, addressLine1: true, addressLine2: true,
        city: true, state: true, zip: true, country: true,
      },
    }),
    getCommissionRates(),
  ]);

  if (!order || order.userId !== session.user.id) notFound();

  // Use the name/address snapshotted on the order, fall back to current profile
  const slipName    = order.returnName        || user?.fullName    || user?.displayName || user?.username || "";
  const slipPhone   = order.returnPhone       || user?.phone       || "";
  const slipAddr1   = order.returnAddressLine1 || user?.addressLine1 || "";
  const slipAddr2   = order.returnAddressLine2 || user?.addressLine2 || "";
  const slipCity    = order.returnCity        || user?.city        || "";
  const slipState   = order.returnState       || user?.state       || "";
  const slipZip     = order.returnZip         || user?.zip         || "";
  const slipCountry = order.returnCountry     || user?.country     || "";
  const orderRef    = `CC-${id.slice(-8).toUpperCase()}`;
  const submittedOn = new Date(order.submittedAt).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  // QR code — points to the admin receive page; scanning marks the order received
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  const sig      = generateReceiveToken(id);
  const receiveUrl = `${appUrl}/admin/consignments/${id}/receive?sig=${sig}`;
  const qrDataUrl  = await QRCode.toDataURL(receiveUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    width:  140,
    color:  { dark: "#000000", light: "#ffffff" },
  });

  return (
    <>
      <PrintTrigger />
      <PrintBar orderId={id} />

      <div className="max-w-2xl mx-auto p-8 print:p-6 print:max-w-none font-sans text-black">

        {/* Header */}
        <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-black">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">The Card Cloud</h1>
            <p className="text-sm text-gray-500 mt-0.5">Consignment Packing Slip</p>
          </div>
          <div className="flex items-start gap-5">
            {/* QR code — scan to mark received and open check-in */}
            <div className="text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="Scan to receive" width={70} height={70} className="mx-auto" />
              <p className="text-gray-400 text-xs mt-1 leading-tight">Scan to<br/>receive</p>
            </div>
            <div className="text-right text-sm">
              <p className="font-bold text-lg font-mono">{orderRef}</p>
              <p className="text-gray-500">{submittedOn}</p>
            </div>
          </div>
        </div>

        {/* Two-column: ship to / from */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Ship cards to</p>
            <div className="border-2 border-black rounded-lg p-4">
              <p className="font-bold text-base">The Card Cloud</p>
              <p className="text-sm mt-0.5">69 Nagy Rd</p>
              <p className="text-sm">Ashford, CT 06278</p>
              <p className="text-sm text-gray-500 mt-2">United States</p>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">From</p>
            <div className="border border-gray-200 rounded-lg p-4 text-sm space-y-0.5">
              {slipName  && <p className="font-semibold text-base">{slipName}</p>}
              {user?.email && <p className="text-gray-600">{user.email}</p>}
              {slipPhone && <p className="text-gray-600">{slipPhone}</p>}
              {slipAddr1 && (
                <div className="pt-1">
                  <p className="text-gray-700">{slipAddr1}</p>
                  {slipAddr2 && <p className="text-gray-700">{slipAddr2}</p>}
                  {(slipCity || slipState || slipZip) && (
                    <p className="text-gray-700">
                      {[slipCity, slipState].filter(Boolean).join(", ")}
                      {slipZip ? ` ${slipZip}` : ""}
                    </p>
                  )}
                  {slipCountry && slipCountry !== "United States" && (
                    <p className="text-gray-500">{slipCountry}</p>
                  )}
                </div>
              )}
              <p className="text-gray-400 pt-1">Order ref: <span className="font-mono font-medium text-black">{orderRef}</span></p>
            </div>
          </div>
        </div>

        {/* Important notice */}
        <div className="bg-gray-100 rounded-lg p-4 mb-8 border border-gray-300">
          <p className="font-bold text-sm">⚠ Please include this slip inside your package.</p>
          <p className="text-sm text-gray-600 mt-1">
            This helps us match your shipment to your order immediately when it arrives. Wrap each card
            individually in a penny sleeve and top loader before packing.
          </p>
        </div>

        {/* Card list */}
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
          Cards being consigned ({order.items.length})
        </p>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="text-left py-2 font-semibold">#</th>
              <th className="text-left py-2 font-semibold">Player / Card</th>
              <th className="text-left py-2 font-semibold">Year · Set</th>
              <th className="text-left py-2 font-semibold">Grade / Condition</th>
              <th className="text-left py-2 font-semibold">Notes</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, i) => (
              <tr key={item.id} className={`border-b border-gray-200 ${i % 2 === 0 ? "" : "bg-gray-50"}`}>
                <td className="py-2.5 text-gray-400 font-mono text-xs">{i + 1}</td>
                <td className="py-2.5 font-medium">
                  {item.player}
                  {item.cardNumber && <span className="text-gray-400 font-normal text-xs ml-1">#{item.cardNumber}</span>}
                  {item.autographed && <span className="ml-1.5 text-xs text-purple-700 font-semibold">AUTO</span>}
                  {item.numbered && item.serialNumber && <span className="ml-1.5 text-xs text-gray-500 font-mono">{item.serialNumber}</span>}
                </td>
                <td className="py-2.5 text-gray-600">
                  {[item.year, item.set].filter(Boolean).join(" · ")}
                  {item.subset && <span className="block text-xs text-gray-400">{item.subset}</span>}
                </td>
                <td className="py-2.5 text-gray-600">
                  {item.graded
                    ? <span className="font-semibold">{item.gradeCompany} {item.grade}{item.certNumber ? <span className="font-normal text-gray-400 text-xs ml-1">#{item.certNumber}</span> : ""}</span>
                    : (item.condition ?? "Raw")
                  }
                </td>
                <td className="py-2.5 text-gray-400 text-xs">{item.notes ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footer */}
        <div className="mt-10 pt-6 border-t border-gray-200 flex items-start justify-between text-xs text-gray-400">
          <div>
            <p className="font-medium text-gray-600">The Card Cloud</p>
            <p>69 Nagy Rd, Ashford, CT 06278</p>
            <p>thecardcloud.com</p>
          </div>
          <div className="text-right">
            <p>{commissionRates.withPhotos}% commission on final sale price</p>
            <p>Questions? Contact us from your account dashboard</p>
          </div>
        </div>
      </div>
    </>
  );
}
