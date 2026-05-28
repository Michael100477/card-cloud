import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

const CHANGELOG_PATH = path.join(process.cwd(), "CLAUDE_CHANGELOG.md");

export interface ChangelogEntry {
  date: string;
  title: string;
  summary: string;
  sections: { heading: string; items: string[] }[];
}

function parseChangelog(raw: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];

  // Split on entry boundaries (## YYYY-MM-DD)
  const blocks = raw.split(/\n(?=## \d{4}-\d{2}-\d{2})/);

  for (const block of blocks) {
    const headerMatch = block.match(/^## (\d{4}-\d{2}-\d{2}) — (.+)/);
    if (!headerMatch) continue;

    const date  = headerMatch[1];
    const title = headerMatch[2].trim();

    const summaryMatch = block.match(/\*\*Summary:\*\* (.+)/);
    const summary = summaryMatch ? summaryMatch[1].trim() : "";

    // Parse ### sub-sections
    const sections: { heading: string; items: string[] }[] = [];
    const sectionBlocks = block.split(/\n(?=### )/);

    for (const sec of sectionBlocks) {
      const secMatch = sec.match(/^### (.+)\n([\s\S]*)/);
      if (!secMatch) continue;
      const heading = secMatch[1].trim();
      const body    = secMatch[2];
      const items   = body
        .split("\n")
        .filter(l => l.trimStart().startsWith("- "))
        .map(l => l.replace(/^[\s]*- /, "").trim())
        .filter(Boolean);
      if (items.length) sections.push({ heading, items });
    }

    entries.push({ date, title, summary, sections });
  }

  // Newest first
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

export async function GET() {
  if (!fs.existsSync(CHANGELOG_PATH)) {
    return NextResponse.json({ entries: [] });
  }
  const raw     = fs.readFileSync(CHANGELOG_PATH, "utf-8");
  const entries = parseChangelog(raw);
  return NextResponse.json({ entries });
}
