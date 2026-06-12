/** Map a carrier code + tracking number to the carrier's public tracking
 *  URL. Falls back to 17track.net which auto-detects across major carriers
 *  if we don't recognize the carrier. */
export function trackingUrl(carrier: string | null, tracking: string): string {
  const c = (carrier ?? "").toUpperCase();
  if (c.includes("USPS"))  return `https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=${tracking}`;
  if (c.includes("UPS"))   return `https://www.ups.com/track?tracknum=${tracking}`;
  if (c.includes("FEDEX")) return `https://www.fedex.com/fedextrack/?trknbr=${tracking}`;
  if (c.includes("DHL"))   return `https://www.dhl.com/en/express/tracking.html?AWB=${tracking}`;
  return `https://www.17track.net/en/track?nums=${tracking}`;
}
