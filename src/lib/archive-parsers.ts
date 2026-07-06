import { readTextFile, readDir } from "@tauri-apps/plugin-fs";
import { createImportItem } from "./actions/import";
import type { ImportMilestoneContent, ImportCareerContent, ImportStoryContent } from "./models";

// ── Platform detection ────────────────────────────────────────────────────

export type Platform = "facebook" | "instagram" | "linkedin" | "unknown";

export async function detectPlatform(extractedPath: string): Promise<Platform> {
  try {
    const entries = await readDir(extractedPath);
    const names = entries.map((e) => e.name ?? "").map((n) => n.toLowerCase());

    if (names.some((n) => n.includes("your_facebook_activity") || n.includes("your_facebook_data"))) return "facebook";
    if (names.some((n) => n.includes("content") || n.includes("personal_information"))) {
      // Check for Instagram-specific sub-structure
      const contentEntry = entries.find((e) => e.name?.toLowerCase().includes("content"));
      const subEntries = await readDir(extractedPath + "/" + (contentEntry?.name ?? ""));
      if (subEntries.some((e) => e.name?.includes("posts_1.json"))) return "instagram";
    }
    if (names.some((n) => n === "profile.csv" || n === "positions.csv")) return "linkedin";
    // Try Instagram if there's content/posts_1.json anywhere
    if (names.includes("content")) return "instagram";
  } catch {
    // Ignore readDir failures — fall through to unknown
  }
  return "unknown";
}

// ── Simple CSV parser ─────────────────────────────────────────────────────

function parseCSV(text: string): Array<Record<string, string>> {
  // Character-by-character parse so newlines inside quoted fields (common in
  // LinkedIn description/summary columns) don't split a record in two.
  const records: string[][] = [];
  let cols: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') { cur += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === "," && !inQuotes) {
      cols.push(cur.trim()); cur = "";
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      cols.push(cur.trim()); cur = "";
      if (cols.some((c) => c !== "")) records.push(cols);
      cols = [];
    } else {
      cur += ch;
    }
  }
  cols.push(cur.trim());
  if (cols.some((c) => c !== "")) records.push(cols);

  if (records.length < 2) return [];
  const headers = records[0];
  return records.slice(1).map((rec) => {
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h.trim()] = rec[idx]?.trim() ?? ""; });
    return row;
  });
}

// ── Timestamp helpers ─────────────────────────────────────────────────────

function epochToISO(ts: number): string {
  return new Date(ts * 1000).toISOString().substring(0, 10);
}

function linkedInDateToISO(s: string): string | null {
  if (!s) return null;
  // "Jan 2015" or "2015"
  const monthMap: Record<string, string> = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
    Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
  };
  const parts = s.trim().split(" ");
  if (parts.length === 2 && monthMap[parts[0]]) {
    return `${parts[1]}-${monthMap[parts[0]]}`;
  }
  if (parts.length === 1 && /^\d{4}$/.test(parts[0])) return parts[0];
  return null;
}

// ── Facebook parser ───────────────────────────────────────────────────────

interface FBPost {
  timestamp: number;
  data?: Array<{ post?: string }>;
  title?: string;
}

export async function parseFacebook(
  extractedPath: string,
  jobId?: number,
  onProgress?: (msg: string) => void
): Promise<number> {
  onProgress?.("Looking for Facebook posts…");
  let count = 0;

  // Try common paths
  const postPaths = [
    `${extractedPath}/your_facebook_activity/posts/your_posts_1.json`,
    `${extractedPath}/posts/your_posts_1.json`,
    `${extractedPath}/your_posts_1.json`,
  ];

  for (const p of postPaths) {
    try {
      const raw = await readTextFile(p);
      const posts: FBPost[] = JSON.parse(raw) as FBPost[];
      onProgress?.(`Parsing ${posts.length} Facebook posts…`);

      for (const post of posts) {
        const text = post.data?.[0]?.post ?? post.title ?? "";
        if (!text || text.length < 20) continue; // skip very short posts

        const date = epochToISO(post.timestamp);
        const content: ImportStoryContent = {
          title: text.substring(0, 80) + (text.length > 80 ? "…" : ""),
          excerpt: text.substring(0, 300),
          event_date: date,
          event_date_precision: "day",
          content: JSON.stringify({
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text }] }],
          }),
        };
        await createImportItem({ import_job_id: jobId, item_type: "story", content, ai_confidence: 0.6 });
        count++;
        if (count >= 50) break; // Cap at 50 posts
      }
      break;
    } catch { continue; }
  }

  return count;
}

// ── Instagram parser ──────────────────────────────────────────────────────

interface IGPost {
  media?: Array<{
    uri: string;
    title?: string;
    creation_timestamp: number;
  }>;
}

export async function parseInstagram(
  extractedPath: string,
  jobId?: number,
  onProgress?: (msg: string) => void
): Promise<number> {
  onProgress?.("Looking for Instagram posts…");
  let count = 0;

  const postPaths = [
    `${extractedPath}/content/posts_1.json`,
    `${extractedPath}/posts_1.json`,
  ];

  for (const p of postPaths) {
    try {
      const raw = await readTextFile(p);
      const posts: IGPost[] = JSON.parse(raw) as IGPost[];
      onProgress?.(`Parsing ${posts.length} Instagram posts…`);

      for (const post of posts) {
        const media = post.media?.[0];
        if (!media) continue;
        const caption = media.title ?? "";
        if (!caption || caption.length < 10) continue;

        const date = epochToISO(media.creation_timestamp);
        const content: ImportStoryContent = {
          title: caption.substring(0, 80) + (caption.length > 80 ? "…" : ""),
          excerpt: caption.substring(0, 300),
          event_date: date,
          event_date_precision: "day",
          content: JSON.stringify({
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: caption }] }],
          }),
        };
        await createImportItem({ import_job_id: jobId, item_type: "story", content, ai_confidence: 0.6 });
        count++;
        if (count >= 50) break;
      }
      break;
    } catch { continue; }
  }

  return count;
}

// ── LinkedIn parser ───────────────────────────────────────────────────────

export async function parseLinkedIn(
  extractedPath: string,
  jobId?: number,
  onProgress?: (msg: string) => void
): Promise<number> {
  onProgress?.("Looking for LinkedIn data…");
  let count = 0;

  // Positions.csv
  const positionPaths = [
    `${extractedPath}/Positions.csv`,
    `${extractedPath}/positions.csv`,
  ];
  for (const p of positionPaths) {
    try {
      const raw = await readTextFile(p);
      const rows = parseCSV(raw);
      onProgress?.(`Parsing ${rows.length} LinkedIn positions…`);

      for (const row of rows) {
        const company = row["Company Name"] ?? row["company"] ?? "";
        const title = row["Title"] ?? row["title"] ?? "";
        if (!company) continue;

        const startRaw = row["Started On"] ?? row["start_date"] ?? "";
        const endRaw = row["Finished On"] ?? row["end_date"] ?? "";
        const isCurrent = !endRaw || endRaw.trim() === "";

        const content: ImportCareerContent = {
          entry_type: "job",
          organization: company,
          title: title || undefined,
          description: row["Description"] || undefined,
          start_date: linkedInDateToISO(startRaw) ?? undefined,
          end_date: isCurrent ? undefined : linkedInDateToISO(endRaw) ?? undefined,
          is_current: isCurrent,
          location: row["Location"] || undefined,
        };
        await createImportItem({ import_job_id: jobId, item_type: "career", content, ai_confidence: 0.95 });
        count++;
      }
      break;
    } catch { continue; }
  }

  // Education.csv
  const edPaths = [
    `${extractedPath}/Education.csv`,
    `${extractedPath}/education.csv`,
  ];
  for (const p of edPaths) {
    try {
      const raw = await readTextFile(p);
      const rows = parseCSV(raw);
      onProgress?.(`Parsing ${rows.length} LinkedIn education entries…`);

      for (const row of rows) {
        const school = row["School Name"] ?? row["school"] ?? "";
        if (!school) continue;

        const startRaw = row["Start Date"] ?? "";
        const endRaw = row["End Date"] ?? "";

        const content: ImportCareerContent = {
          entry_type: "education",
          organization: school,
          title: row["Degree Name"] ?? row["degree"] ?? undefined,
          description: row["Activities"] || row["Notes"] || undefined,
          start_date: linkedInDateToISO(startRaw) ?? undefined,
          end_date: linkedInDateToISO(endRaw) ?? undefined,
          is_current: false,
        };
        await createImportItem({ import_job_id: jobId, item_type: "career", content, ai_confidence: 0.95 });
        count++;
      }
      break;
    } catch { continue; }
  }

  // Profile.csv — extract milestone from headline/summary
  const profilePaths = [`${extractedPath}/Profile.csv`, `${extractedPath}/profile.csv`];
  for (const p of profilePaths) {
    try {
      const raw = await readTextFile(p);
      const rows = parseCSV(raw);
      if (rows.length > 0) {
        const profile = rows[0];
        const summary = profile["Summary"] ?? profile["summary"] ?? "";
        if (summary && summary.length > 50) {
          const content: ImportMilestoneContent = {
            title: "LinkedIn Professional Summary",
            description: summary.substring(0, 500),
            date: new Date().toISOString().substring(0, 10),
            date_precision: "year",
            category: "Career",
          };
          await createImportItem({ import_job_id: jobId, item_type: "milestone", content, ai_confidence: 0.8 });
          count++;
        }
      }
      break;
    } catch { continue; }
  }

  return count;
}

// ── Main dispatch ─────────────────────────────────────────────────────────

export async function parseArchive(
  extractedPath: string,
  platform: Platform,
  jobId?: number,
  onProgress?: (msg: string) => void
): Promise<number> {
  if (platform === "facebook") return parseFacebook(extractedPath, jobId, onProgress);
  if (platform === "instagram") return parseInstagram(extractedPath, jobId, onProgress);
  if (platform === "linkedin") return parseLinkedIn(extractedPath, jobId, onProgress);

  // Unknown — try all
  onProgress?.("Unknown archive format — trying all parsers…");
  let count = 0;
  count += await parseFacebook(extractedPath, jobId, onProgress);
  count += await parseInstagram(extractedPath, jobId, onProgress);
  count += await parseLinkedIn(extractedPath, jobId, onProgress);
  return count;
}
