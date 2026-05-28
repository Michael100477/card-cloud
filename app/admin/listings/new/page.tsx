import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { NewListingForm } from "./NewListingForm";

interface Props { searchParams: Promise<{ itemId?: string }> }

export default async function NewListingPage({ searchParams }: Props) {
  const { itemId } = await searchParams;
  if (!itemId) notFound();

  const item = await db.consignmentItem.findUnique({
    where:   { id: itemId },
    include: {
      order:   { select: { id: true, user: { select: { displayName: true, username: true, email: true } } } },
      listing: { select: { id: true } },
    },
  });
  if (!item || item.listing) notFound();

  const suggestedTitle = [
    item.year, item.manufacturer, item.set, item.subset,
    item.player, item.cardNumber ? `#${item.cardNumber}` : null,
    item.graded && item.gradeCompany ? `${item.gradeCompany} ${item.grade}` : null,
    item.autographed ? "AUTO" : null,
    item.numbered && item.serialNumber ? item.serialNumber : null,
  ].filter(Boolean).join(" ");

  const userName = item.order.user.displayName ?? item.order.user.username ?? item.order.user.email;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-navy mb-1">Create eBay Listing</h1>
      <p className="text-slate-400 text-sm mb-6">
        Card from {userName}&apos;s consignment ·{" "}
        <a href={`/admin/consignments/${item.order.id}`} className="text-brand hover:underline">View order</a>
      </p>

      <div className="bg-slate-50 rounded-xl p-4 mb-6 text-sm">
        <p className="text-navy font-semibold">{item.player}</p>
        <p className="text-slate-500">
          {[item.year, item.manufacturer, item.set, item.subset].filter(Boolean).join(" · ")}
          {item.graded ? ` · ${item.gradeCompany} ${item.grade}` : ""}
        </p>
        {item.askingPrice && <p className="text-amber-700 text-xs mt-1">Seller asking: ${Number(item.askingPrice).toLocaleString()}</p>}
      </div>

      <NewListingForm itemId={itemId} orderId={item.order.id} suggestedTitle={suggestedTitle} />
    </div>
  );
}

