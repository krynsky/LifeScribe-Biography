import Anthropic from "@anthropic-ai/sdk";
import { createImportItem } from "./actions/import";
import type {
  ImportStoryContent,
  ImportMilestoneContent,
  ImportCareerContent,
  ImportMapPinContent,
} from "./models";

// ── API key ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "lifescribe_anthropic_key";

export function getApiKey(): string {
  return localStorage.getItem(STORAGE_KEY) ?? "";
}

export function saveApiKey(key: string): void {
  localStorage.setItem(STORAGE_KEY, key);
}

// ── Curation prompt ────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are LifeScribe, a biographical content curator.
Given raw personal notes, journal entries, or social media posts, extract structured biography content.
Return ONLY valid JSON matching the schema below — no markdown fences, no explanation.

Schema:
{
  "stories": [{ "title": string, "excerpt": string, "event_date": "YYYY-MM-DD" | null, "event_date_precision": "day"|"month"|"year" }],
  "milestones": [{ "title": string, "description": string | null, "date": "YYYY-MM-DD", "date_precision": "day"|"month"|"year", "category": string | null }],
  "career": [{ "entry_type": "job"|"education", "organization": string, "title": string | null, "start_date": "YYYY-MM" | null, "end_date": "YYYY-MM" | null, "is_current": boolean, "location": string | null }],
  "map_pins": [{ "name": string, "description": string | null, "address": string | null, "visit_date": "YYYY-MM-DD" | null }]
}

Rules:
- Only extract items clearly supported by the text — do not invent details.
- Dates must be parseable ISO strings. Omit uncertain date components (e.g. use year precision if only year is mentioned).
- stories get a title and 1-2 sentence excerpt — the full prose will be written by the user.
- Omit any array if no items were found (empty arrays ok).
- Confidence is implicit — only include high-confidence items.`;

// ── Extracted types from Claude response ──────────────────────────────────

interface CuratedStory {
  title: string;
  excerpt: string;
  event_date: string | null;
  event_date_precision: "day" | "month" | "year";
}

interface CuratedMilestone {
  title: string;
  description: string | null;
  date: string;
  date_precision: "day" | "month" | "year";
  category: string | null;
}

interface CuratedCareer {
  entry_type: "job" | "education";
  organization: string;
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  location: string | null;
}

interface CuratedMapPin {
  name: string;
  description: string | null;
  address: string | null;
  visit_date: string | null;
}

interface CuratedResult {
  stories?: CuratedStory[];
  milestones?: CuratedMilestone[];
  career?: CuratedCareer[];
  map_pins?: CuratedMapPin[];
}

// ── Main curator function ─────────────────────────────────────────────────

export interface CurationSummary {
  stories: number;
  milestones: number;
  career: number;
  map_pins: number;
  total: number;
}

export async function curateText(
  rawText: string,
  importJobId?: number,
  onProgress?: (msg: string) => void
): Promise<CurationSummary> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("No API key configured. Add your Anthropic API key in Settings.");

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  onProgress?.("Sending to Claude for analysis…");

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: `Extract biography content from the following text:\n\n${rawText}` }],
  });

  const raw = response.content[0];
  if (raw.type !== "text") throw new Error("Unexpected response type from Claude");

  onProgress?.("Parsing response…");

  // The prompt forbids markdown fences, but strip them if present anyway.
  const jsonText = raw.text.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");

  let parsed: CuratedResult;
  try {
    parsed = JSON.parse(jsonText) as CuratedResult;
  } catch {
    throw new Error(`Failed to parse Claude response as JSON: ${raw.text.substring(0, 200)}`);
  }

  onProgress?.("Saving suggestions…");

  const summary: CurationSummary = { stories: 0, milestones: 0, career: 0, map_pins: 0, total: 0 };

  // Stories
  for (const s of parsed.stories ?? []) {
    const content: ImportStoryContent = {
      title: s.title,
      excerpt: s.excerpt,
      event_date: s.event_date ?? undefined,
      event_date_precision: s.event_date_precision,
      content: JSON.stringify({
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: s.excerpt }] }],
      }),
    };
    await createImportItem({ import_job_id: importJobId, item_type: "story", content, ai_confidence: 0.85 });
    summary.stories++;
  }

  // Milestones
  for (const m of parsed.milestones ?? []) {
    const content: ImportMilestoneContent = {
      title: m.title,
      description: m.description ?? undefined,
      date: m.date,
      date_precision: m.date_precision,
      category: m.category ?? undefined,
    };
    await createImportItem({ import_job_id: importJobId, item_type: "milestone", content, ai_confidence: 0.9 });
    summary.milestones++;
  }

  // Career
  for (const c of parsed.career ?? []) {
    const content: ImportCareerContent = {
      entry_type: c.entry_type,
      organization: c.organization,
      title: c.title ?? undefined,
      start_date: c.start_date ?? undefined,
      end_date: c.end_date ?? undefined,
      is_current: c.is_current,
      location: c.location ?? undefined,
    };
    await createImportItem({ import_job_id: importJobId, item_type: "career", content, ai_confidence: 0.9 });
    summary.career++;
  }

  // Map pins
  for (const p of parsed.map_pins ?? []) {
    const content: ImportMapPinContent = {
      name: p.name,
      description: p.description ?? undefined,
      address: p.address ?? undefined,
      visit_date: p.visit_date ?? undefined,
      latitude: 0,
      longitude: 0,
    };
    await createImportItem({ import_job_id: importJobId, item_type: "map_pin", content, ai_confidence: 0.8 });
    summary.map_pins++;
  }

  summary.total = summary.stories + summary.milestones + summary.career + summary.map_pins;
  onProgress?.(`Done — ${summary.total} suggestion${summary.total !== 1 ? "s" : ""} created`);

  return summary;
}
