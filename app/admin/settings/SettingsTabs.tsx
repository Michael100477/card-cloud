"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { SettingsClient } from "./SettingsClient";
import { LinksClient } from "@/app/admin/links/LinksClient";
import { ContentClient } from "@/app/admin/content/ContentClient";
import { LayoutClient } from "@/app/admin/layout/LayoutClient";
import type { WidgetDef } from "@/lib/layout";

interface EbayStatus   { connected: boolean; seller: string | null; expiresAt: string | null; environment: string }
interface ShippingRates { envelopeCost: number; envelopeMaxValue: number; bubbleMailerMin: number; bubbleMailerMax: number }
interface SiteLink     { id: string; key: string; section: string; label: string; href: string; enabled: boolean; order: number }
interface SitePage     { id: string; path: string; label: string }

interface Props {
  // Settings props
  withPhotos: string; withoutPhotos: string;
  exchangeStandard: string; exchangePremier: string; exchangePremierThreshold: string;
  ebay: EbayStatus; shipping: ShippingRates;
  trackFreeLimit: string; trackMonthly: string; trackYearly: string;
  offerFee: string;
  tradeCostPerSide: string; tradeServiceFee: string; tradeShippingFee: string;
  ebayDefaultListingType: string; ebayDefaultAuctionDuration: string;
  ebayDefaultStartPrice: string; ebayDefaultScheduledTime: string;
  tradeShipName: string; tradeShipStreet1: string; tradeShipStreet2: string;
  tradeShipCity: string; tradeShipState: string; tradeShipPostalCode: string;
  supplyCostEnvelope: string; supplyCostLabel: string; supplyCostPackingSlip: string;
  supplyCostTapePerInch: string; supplyTapeInchesPerOrder: string;
  supplyInvEnvelope: string; supplyInvEnvelopeThreshold: string;
  supplyInvLabel: string; supplyInvLabelThreshold: string;
  supplyInvPackingSlip: string; supplyInvPackingSlipThreshold: string;
  defaultShippingType: string;
  // Links props
  links: SiteLink[];
  sitePages: SitePage[];
  sectionOrder: string[];
  // Content props
  cmsSections: { section: string; slots: { key: string; label: string; defaultValue: string; multiline: boolean; type?: string }[] }[];
  cmsValueMap: Record<string, string>;
  // Page Layout props
  layoutPages: string[];
  layoutByPage: Record<string, { id: string; page: string; widgetKey: string; order: number; enabled: boolean }[]>;
  layoutRegistry: Record<string, WidgetDef>;
}

type Tab = "rates" | "links" | "content" | "layout";

export function SettingsTabs({ links, sitePages, sectionOrder, cmsSections, cmsValueMap, layoutPages, layoutByPage, layoutRegistry, ...settingsProps }: Props) {
  const params = useSearchParams();
  const router = useRouter();
  const p = params.get("tab");
  const initialTab: Tab = p === "links" ? "links" : p === "content" ? "content" : p === "layout" ? "layout" : "rates";
  const [tab, setTab] = useState<Tab>(initialTab);

  function switchTab(t: Tab) {
    setTab(t);
    router.replace(`/admin/settings${t === "rates" ? "" : `?tab=${t}`}`, { scroll: false });
  }

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 bg-slate-200 p-1 rounded-xl mb-6 w-fit">
        {(["rates", "links", "content", "layout"] as Tab[]).map(t => (
          <button key={t} onClick={() => switchTab(t)}
            className={`px-5 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t ? "bg-white text-navy shadow-sm" : "text-slate-500 hover:text-navy"}`}
          >
            {t === "links" ? "Links & Buttons" : t === "content" ? "Content" : t === "layout" ? "Page Layout" : "Rates"}
          </button>
        ))}
      </div>

      {tab === "rates"   && <SettingsClient {...settingsProps} />}
      {tab === "links"   && <LinksClient initialLinks={links} sitePages={sitePages} sectionOrder={sectionOrder} />}
      {tab === "content" && <ContentClient sections={cmsSections} valueMap={cmsValueMap} sitePages={sitePages} />}
      {tab === "layout"  && <LayoutClient pages={layoutPages} initialLayouts={layoutByPage} registry={layoutRegistry} />}
    </div>
  );
}
