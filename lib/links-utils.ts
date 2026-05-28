/**
 * Pure client-safe helpers for working with LinksMap.
 * No database imports — safe to use in Client Components.
 */

export interface SiteLink {
  key:     string;
  section: string;
  label:   string;
  href:    string;
  enabled: boolean;
  order:   number;
}

export type LinksMap = Record<string, SiteLink>;

export function getLink(
  map: LinksMap,
  key: string,
): { label: string; href: string } | null {
  const l = map[key];
  if (!l || !l.enabled) return null;
  return { label: l.label, href: l.href };
}
