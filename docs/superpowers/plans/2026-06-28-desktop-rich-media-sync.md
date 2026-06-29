# Desktop Rich Media Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the LifeScribe desktop app render all web content identically (Google Maps, YouTube, Vimeo, oEmbed) and download all photos/images from the web to local storage during sync.

**Architecture:** Port the four web-only Tiptap extensions (GoogleMapsEmbed, VimeoEmbed, OEmbedBlock, Youtube) directly into the desktop app — Tauri runs WebView2 so iframes and embeds work natively. Extend the sync pull API to include media metadata with R2 download URLs, then have the desktop download each file to `appLocalDataDir()/media/` during `mergePullResult`, serving them via the Tauri asset protocol.

**Tech Stack:** Tauri 2 (WebView2), React 19, Tiptap 2, `@tauri-apps/plugin-fs` (writeFile/mkdir), `@tauri-apps/api/path` (appLocalDataDir/join), `@tauri-apps/api/core` (convertFileSrc), Next.js App Router (Vercel), Prisma + Neon PostgreSQL

---

## Repos

- **Desktop** (this repo): `D:/My Data/My Apps/LifeScribe Biography/`
- **Web** (monorepo): `D:/My Data/My Apps/LifeScribe/`
- Web pull route: `apps/web/src/app/api/v1/sync/pull/route.ts`
- Web deploy: push to `master` branch → Vercel auto-deploys

## Verified facts (from codebase/DB inspection)

- Real media CDN domain: **`https://files.lifescribe.us/`** (e.g. `https://files.lifescribe.us/sites/{siteId}/{uuid}.jpg`). NOT `r2.dev` or `r2.cloudflarestorage.com`.
- Production has **112 media rows**, almost all `IMAGE`.
- `tauri.conf.json` currently has **no `assetProtocol` block** and `csp: null`. The asset protocol must be explicitly enabled for `convertFileSrc()` to serve files from app storage.
- The desktop currently writes nothing to app storage; existing imports display the user's original picked-file paths.
- Tiptap core is pinned to `^2.11.5`. `@tiptap/extension-youtube` must be pinned to the v2 line (`^2.11.5` → resolves to 2.27.2); the unpinned latest is v3 and is incompatible.
- The user has synced before, so `lifescribe_last_pull_at` holds a recent timestamp. The pull route filters media by `createdAt >= since` and posts by `updatedAt >= since`, so a normal sync will **not** re-pull existing content. A one-time full re-pull is required.

## File Map

### Desktop repo — create
- `src/components/editor/extensions/google-maps-embed.ts`
- `src/components/editor/extensions/vimeo-embed.ts`
- `src/components/editor/extensions/oembed-block.tsx`

### Desktop repo — modify
- `src-tauri/tauri.conf.json` — enable asset protocol with `$APPLOCALDATA/**` scope
- `package.json` — add `@tiptap/extension-youtube@^2.11.5`
- `src/components/editor/StoryEditor.tsx` — register 4 new extensions
- `src/lib/sync-service.ts` — add `PulledMedia` type, media download, `fullPull` option
- `src-tauri/capabilities/default.json` — add `https://files.lifescribe.us/**` to http allowlist
- `src/pages/settings/SettingsPage.tsx` — add "Re-sync everything" button

### Web repo — modify
- `apps/web/src/app/api/v1/sync/pull/route.ts` — add media query + expand DESKTOP_NODES

---

## Task 1: Enable asset protocol and verify file serving (de-risking spike)

This is the highest-risk unknown: files written to app storage must be serveable by `convertFileSrc()`. We enable the asset protocol and verify it works **before** building the download pipeline, so we don't discover a broken scope at the end.

**Files:**
- Modify: `src-tauri/tauri.conf.json`

- [ ] **Step 1: Add `assetProtocol` config to tauri.conf.json**

Replace the `app.security` block (currently `"security": { "csp": null }`) with:

```json
    "security": {
      "csp": null,
      "assetProtocol": {
        "enable": true,
        "scope": ["$APPLOCALDATA/**", "$APPDATA/**", "$HOME/**"]
      }
    }
```

`$APPLOCALDATA/**` covers the new `media/` download dir. `$HOME/**` preserves display of existing imported photos that live under the user's home directory.

- [ ] **Step 2: Add the asset-protocol fs permission to capabilities**

Open `src-tauri/capabilities/default.json`. In the `permissions` array, after `"fs:allow-stat"`, add:

```json
    "fs:scope-app-data-recursive",
```

This grants the asset protocol read access to the app-local-data tree.

- [ ] **Step 3: Write a temporary verification snippet**

Temporarily add this `useEffect` to the top of the `SettingsPage` component body (`src/pages/settings/SettingsPage.tsx`), right after the existing `useState` hooks, to prove a file written to app storage displays:

```typescript
  // TEMP spike — remove after verification
  const [spikeUrl, setSpikeUrl] = useState<string>("");
  useEffect(() => {
    (async () => {
      const { appLocalDataDir, join } = await import("@tauri-apps/api/path");
      const { mkdir, writeFile } = await import("@tauri-apps/plugin-fs");
      const { convertFileSrc } = await import("@tauri-apps/api/core");
      // 1x1 red PNG
      const png = Uint8Array.from(atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
      ), (c) => c.charCodeAt(0));
      const dir = await join(await appLocalDataDir(), "media");
      await mkdir(dir, { recursive: true });
      const path = await join(dir, "spike.png");
      await writeFile(path, png);
      setSpikeUrl(convertFileSrc(path));
    })().catch(console.error);
  }, []);
```

And add this near the top of the returned JSX (inside the outer `<div className="p-8 max-w-2xl">`):

```tsx
      {spikeUrl && <img src={spikeUrl} alt="spike" width={32} height={32} style={{ border: "2px solid lime" }} />}
```

- [ ] **Step 4: Run the app and confirm the image displays**

```bash
cd "D:/My Data/My Apps/LifeScribe Biography"
npm run tauri dev
```

Navigate to Settings. **Expected:** a small red square with a lime border renders. If it shows a broken-image icon, the asset protocol scope is wrong — fix the scope before proceeding (do not continue to Task 4).

- [ ] **Step 5: Remove the temporary spike code**

Delete the TEMP `useEffect`, the `spikeUrl` state, and the spike `<img>` from `SettingsPage.tsx`.

- [ ] **Step 6: Commit the config changes**

```bash
git add src-tauri/tauri.conf.json src-tauri/capabilities/default.json
git commit -m "feat(tauri): enable asset protocol for app-local-data media files"
```

---

## Task 2: Install YouTube extension and create embed extension files

All four extensions run fine in WebView2 since it's a full browser engine.

**Files:**
- Create: `src/components/editor/extensions/google-maps-embed.ts`
- Create: `src/components/editor/extensions/vimeo-embed.ts`
- Create: `src/components/editor/extensions/oembed-block.tsx`
- Modify: `package.json`

- [ ] **Step 1: Install `@tiptap/extension-youtube` pinned to the v2 line**

```bash
cd "D:/My Data/My Apps/LifeScribe Biography"
npm install @tiptap/extension-youtube@^2.11.5
```

Expected: `package.json` shows `"@tiptap/extension-youtube": "^2.11.5"` resolving to 2.27.x (NOT 3.x). Verify with:

```bash
npm ls @tiptap/extension-youtube
```

- [ ] **Step 2: Create `google-maps-embed.ts`**

```typescript
// src/components/editor/extensions/google-maps-embed.ts
import { Node } from "@tiptap/core";

export interface GoogleMapsEmbedOptions {
  HTMLAttributes: Record<string, string>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    googleMapsEmbed: {
      setGoogleMapsEmbed: (options: { src: string }) => ReturnType;
    };
  }
}

export const GoogleMapsEmbed = Node.create<GoogleMapsEmbedOptions>({
  name: "googleMapsEmbed",
  group: "block",
  atom: true,
  draggable: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      src: { default: null },
      width: { default: "100%" },
      height: { default: 450 },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-google-maps-embed]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      { "data-google-maps-embed": "", style: "margin:1rem 0;" },
      [
        "iframe",
        {
          src: HTMLAttributes.src,
          width: HTMLAttributes.width,
          height: HTMLAttributes.height,
          frameborder: "0",
          allowfullscreen: "true",
          referrerpolicy: "no-referrer-when-downgrade",
          loading: "lazy",
          style: "width:100%;border:0;border-radius:0.5rem;",
        },
      ],
    ];
  },

  addCommands() {
    return {
      setGoogleMapsEmbed:
        (options) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { src: options.src } }),
    };
  },
});
```

- [ ] **Step 3: Create `vimeo-embed.ts`**

```typescript
// src/components/editor/extensions/vimeo-embed.ts
import { Node, nodePasteRule } from "@tiptap/core";

export interface VimeoEmbedOptions {
  HTMLAttributes: Record<string, string>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    vimeoEmbed: {
      setVimeoEmbed: (options: { src: string }) => ReturnType;
    };
  }
}

const VIMEO_REGEX_PASTE =
  /^https?:\/\/(?:www\.)?(?:vimeo\.com\/(\d+)(?:\/[a-zA-Z0-9]+)?|player\.vimeo\.com\/video\/(\d+))(?:\?.*)?$/g;

export const VimeoEmbed = Node.create<VimeoEmbedOptions>({
  name: "vimeoEmbed",
  group: "block",
  atom: true,
  draggable: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      src: { default: null },
      width: { default: 640 },
      height: { default: 360 },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-vimeo-embed]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const videoId = HTMLAttributes.src?.match(/\/video\/(\d+)/)?.[1];
    return [
      "div",
      {
        "data-vimeo-embed": "",
        style:
          "position:relative;padding-bottom:56.25%;height:0;overflow:hidden;margin:1rem 0;",
      },
      [
        "iframe",
        {
          src: videoId
            ? `https://player.vimeo.com/video/${videoId}`
            : HTMLAttributes.src,
          width: HTMLAttributes.width,
          height: HTMLAttributes.height,
          frameborder: "0",
          allowfullscreen: "true",
          allow: "autoplay; fullscreen; picture-in-picture",
          style:
            "position:absolute;top:0;left:0;width:100%;height:100%;border-radius:0.5rem;",
        },
      ],
    ];
  },

  addCommands() {
    return {
      setVimeoEmbed:
        (options) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { src: options.src } }),
    };
  },

  addPasteRules() {
    return [
      nodePasteRule({
        find: VIMEO_REGEX_PASTE,
        type: this.type,
        getAttributes: (match) => {
          const id = match[1] || match[2];
          return { src: `https://player.vimeo.com/video/${id}` };
        },
      }),
    ];
  },
});
```

- [ ] **Step 4: Create `oembed-block.tsx`**

```tsx
// src/components/editor/extensions/oembed-block.tsx
import { Node, mergeAttributes } from "@tiptap/core";
import type { DOMOutputSpec } from "@tiptap/pm/model";
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  type ReactNodeViewProps,
} from "@tiptap/react";

export interface OEmbedBlockOptions {
  HTMLAttributes: Record<string, string>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    oembedBlock: {
      setOEmbed: (options: {
        url: string;
        html: string;
        provider: string;
      }) => ReturnType;
    };
  }
}

// HTML was already sanitized server-side by the web's /api/oembed before storage.
function OEmbedNodeView({ node }: ReactNodeViewProps) {
  const html = (node.attrs.html as string) || "";
  const url = (node.attrs.url as string) || "";
  return (
    <NodeViewWrapper className="oembed-block" data-oembed="" data-oembed-url={url}>
      {html ? (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <div
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: "0.5rem",
            padding: "0.5rem 0.75rem",
            fontSize: "0.875rem",
            color: "var(--color-text-muted)",
          }}
        >
          Embed: {url}
        </div>
      )}
    </NodeViewWrapper>
  );
}

export const OEmbedBlock = Node.create<OEmbedBlockOptions>({
  name: "oembedBlock",
  group: "block",
  atom: true,
  draggable: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      url: { default: null },
      html: { default: null },
      provider: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-oembed]" }];
  },

  renderHTML({ node, HTMLAttributes }): DOMOutputSpec {
    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-oembed": "",
        "data-oembed-url": node.attrs.url,
        "data-oembed-html": node.attrs.html || "",
        class: "oembed-block",
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(OEmbedNodeView);
  },

  addCommands() {
    return {
      setOEmbed:
        (options) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { url: options.url, html: options.html, provider: options.provider },
          }),
    };
  },
});
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd "D:/My Data/My Apps/LifeScribe Biography"
npx tsc --noEmit
```

Expected: no errors related to the three new files.

- [ ] **Step 6: Commit**

```bash
git add src/components/editor/extensions/ package.json package-lock.json
git commit -m "feat(editor): add GoogleMapsEmbed, VimeoEmbed, OEmbedBlock, YouTube extensions"
```

---

## Task 3: Register the four new extensions in StoryEditor

**Files:**
- Modify: `src/components/editor/StoryEditor.tsx`

The `EXTENSIONS` constant (lines 59–95) gains four new entries.

- [ ] **Step 1: Add imports after the `TableHeader` import (line 48)**

```typescript
import Youtube from "@tiptap/extension-youtube";
import { GoogleMapsEmbed } from "./extensions/google-maps-embed";
import { VimeoEmbed } from "./extensions/vimeo-embed";
import { OEmbedBlock } from "./extensions/oembed-block";
```

- [ ] **Step 2: Append the four extensions to the EXTENSIONS array**

The end of the array (after `TableHeader,`) should read:

```typescript
  Table.configure({ resizable: true }),
  TableRow,
  TableCell,
  TableHeader,
  Youtube.configure({ inline: false, controls: true }),
  GoogleMapsEmbed,
  VimeoEmbed,
  OEmbedBlock,
];
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "D:/My Data/My Apps/LifeScribe Biography"
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/StoryEditor.tsx
git commit -m "feat(editor): register YouTube, GoogleMapsEmbed, VimeoEmbed, OEmbedBlock in StoryEditor"
```

---

## Task 4: Update web pull route — expand DESKTOP_NODES and add media

Two changes in one commit:
1. Add `youtube`, `vimeoEmbed`, `googleMapsEmbed`, `oembedBlock` to `DESKTOP_NODES` so they are no longer stripped from pulled story content.
2. Add `media` to the pull response so the desktop can download files.

**Files:**
- Modify: `D:/My Data/My Apps/LifeScribe/apps/web/src/app/api/v1/sync/pull/route.ts`

- [ ] **Step 1: Expand DESKTOP_NODES (lines 15–34)**

Replace the existing `DESKTOP_NODES` set with:

```typescript
const DESKTOP_NODES = new Set([
  'doc',
  'paragraph',
  'text',
  'hardBreak',
  'horizontalRule',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'blockquote',
  'codeBlock',
  'taskList',
  'taskItem',
  'image',
  'table',
  'tableRow',
  'tableCell',
  'tableHeader',
  // Embed nodes — rendered natively in WebView2
  'youtube',
  'vimeoEmbed',
  'googleMapsEmbed',
  'oembedBlock',
]);
```

- [ ] **Step 2: Add media to the `Promise.all` destructure (line 113)**

Replace:
```typescript
  const [site, posts, milestones, careerEntries, mapPins, familyMembers, albums] =
    await Promise.all([
```
With:
```typescript
  const [site, posts, milestones, careerEntries, mapPins, familyMembers, albums, mediaItems] =
    await Promise.all([
```

- [ ] **Step 3: Add the media query after the `prisma.album.findMany` call (after line 201)**

Note: the `Media` model has `createdAt` but no `updatedAt`, so filter on `createdAt`.

```typescript
      prisma.media.findMany({
        where: { siteId, createdAt: { gte: sinceDate } },
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          albumId: true,
          url: true,
          thumbnailUrl: true,
          type: true,
          filename: true,
          sizeBytes: true,
          caption: true,
        },
      }),
```

- [ ] **Step 4: Add media to the result mapping after the `albums` block (after line 278)**

```typescript
  if (mediaItems.length > 0) {
    result.media = mediaItems.map((m) => ({
      remote_id: m.id,
      album_remote_id: m.albumId ?? null,
      url: m.url,
      thumbnail_url: m.thumbnailUrl ?? null,
      media_type: m.type.toLowerCase(), // 'image' | 'video'
      filename: m.filename,
      size_bytes: Number(m.sizeBytes),
      caption: m.caption ?? null,
    }));
  }
```

- [ ] **Step 5: Verify TypeScript compiles in the web repo**

```bash
cd "D:/My Data/My Apps/LifeScribe"
pnpm --filter web exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit and push to trigger Vercel deployment**

```bash
cd "D:/My Data/My Apps/LifeScribe"
git add apps/web/src/app/api/v1/sync/pull/route.ts
git commit -m "feat(sync/pull): add media to pull response; allow embed nodes for desktop"
git push origin master
```

Expected: Vercel shows a new deployment building. Wait for "Ready" before testing Task 5/6.

---

## Task 5: Implement media download in desktop sync service

The desktop downloads each media file from its `files.lifescribe.us` URL to `appLocalDataDir()/media/{remote_id}.{ext}`, then inserts a row into the local `media` table so `AlbumPage` can display it. A `fullPull` flag lets the caller ignore the stored `since` timestamp for a one-time complete re-pull.

**Files:**
- Modify: `src/lib/sync-service.ts`
- Modify: `src-tauri/capabilities/default.json`

- [ ] **Step 1: Add `files.lifescribe.us` to the http allowlist**

Open `src-tauri/capabilities/default.json`. Replace the existing `http:allow-fetch` entry:

```json
{
  "identifier": "http:allow-fetch",
  "allow": [{ "url": "https://lifescribe.us/**" }]
}
```

With:

```json
{
  "identifier": "http:allow-fetch",
  "allow": [
    { "url": "https://lifescribe.us/**" },
    { "url": "https://files.lifescribe.us/**" }
  ]
}
```

- [ ] **Step 2: Add path and fs imports to sync-service.ts**

After the existing imports at the top of `src/lib/sync-service.ts`, add:

```typescript
import { appLocalDataDir, join } from "@tauri-apps/api/path";
import { mkdir, writeFile } from "@tauri-apps/plugin-fs";
```

- [ ] **Step 3: Add `PulledMedia` interface and extend `SyncPayload`**

After the existing `SyncPayload` interface (around line 97), add:

```typescript
export interface PulledMedia {
  remote_id: string;
  album_remote_id: string | null;
  url: string;
  thumbnail_url: string | null;
  media_type: "image" | "video";
  filename: string;
  size_bytes: number;
  caption: string | null;
}
```

Then add `media?: PulledMedia[]` to the existing `SyncPayload` interface so it reads:

```typescript
export interface SyncPayload {
  biography?: object;
  stories?: object[];
  milestones?: object[];
  career?: object[];
  map_pins?: object[];
  family_members?: object[];
  albums?: object[];
  media?: PulledMedia[];
}
```

- [ ] **Step 4: Implement `downloadMediaFiles` (with progress reporting)**

Add this function just before `mergePullResult`:

```typescript
async function downloadMediaFiles(
  mediaItems: PulledMedia[],
  onProgress?: (msg: string) => void
): Promise<number> {
  if (mediaItems.length === 0) return 0;

  const dataDir = await appLocalDataDir();
  const mediaDir = await join(dataDir, "media");
  await mkdir(mediaDir, { recursive: true });

  let downloaded = 0;
  let processed = 0;

  for (const item of mediaItems) {
    processed++;
    onProgress?.(`Downloading photos… ${processed}/${mediaItems.length}`);

    // Skip already-downloaded items (idempotent re-pull)
    const existing = await query<{ id: number }>(
      "SELECT id FROM media WHERE remote_id = ?",
      [item.remote_id]
    );
    if (existing.length > 0) continue;

    // Resolve local album_id from the album's remote_id
    let albumId: number | null = null;
    if (item.album_remote_id) {
      const rows = await query<{ id: number }>(
        "SELECT id FROM albums WHERE remote_id = ?",
        [item.album_remote_id]
      );
      albumId = rows[0]?.id ?? null;
    }

    const ext = (item.filename.split(".").pop() ?? "jpg").toLowerCase();
    const localPath = await join(mediaDir, `${item.remote_id}.${ext}`);
    const mimeType =
      item.media_type === "video"
        ? "video/mp4"
        : `image/${ext === "jpg" ? "jpeg" : ext}`;

    try {
      const resp = await fetch(item.url);
      if (!resp.ok) {
        console.warn(`[sync] media download ${resp.status}: ${item.url}`);
        continue;
      }
      const bytes = new Uint8Array(await resp.arrayBuffer());
      await writeFile(localPath, bytes);

      await execute(
        `INSERT OR IGNORE INTO media
           (file_path, thumbnail_path, filename, caption, file_size,
            mime_type, album_id, remote_id, import_source, synced_at)
         VALUES (?,?,?,?,?,?,?,?,'sync',datetime('now'))`,
        [
          localPath,
          localPath,
          item.filename,
          item.caption,
          item.size_bytes,
          mimeType,
          albumId,
          item.remote_id,
        ]
      );
      downloaded++;
    } catch (err) {
      console.error(`[sync] Failed to download media ${item.remote_id}:`, err);
    }
  }

  return downloaded;
}
```

- [ ] **Step 5: Thread an `onProgress` param through `mergePullResult` and wire in the download**

Change the `mergePullResult` signature from:

```typescript
async function mergePullResult(data: SyncPayload): Promise<number> {
```

to:

```typescript
async function mergePullResult(
  data: SyncPayload,
  onProgress?: (msg: string) => void
): Promise<number> {
```

Then, just before the final `return pulled;`, add:

```typescript
  // Download media files from remote storage
  if (data.media?.length) {
    pulled += await downloadMediaFiles(data.media, onProgress);
  }
```

- [ ] **Step 6: Add a `fullPull` option to `syncToRemote` and pass `onProgress` to the merge**

Change the `syncToRemote` signature from:

```typescript
export async function syncToRemote(onProgress?: (msg: string) => void): Promise<FullSyncResult> {
```

to:

```typescript
export async function syncToRemote(
  onProgress?: (msg: string) => void,
  fullPull = false
): Promise<FullSyncResult> {
```

In the pull section near the end, replace:

```typescript
  onProgress?.("Pulling web changes…");
  const since = localStorage.getItem(STORAGE_KEY_LAST_PULL) ?? undefined;
  let pulled = 0;
  try {
    const pullData = await pullFromRemote(since);
    pulled = await mergePullResult(pullData);
    localStorage.setItem(STORAGE_KEY_LAST_PULL, syncStartedAt);
  } catch (err) {
    console.error("[sync] pull failed:", err);
  }
```

With:

```typescript
  onProgress?.("Pulling web changes…");
  const since = fullPull
    ? undefined
    : localStorage.getItem(STORAGE_KEY_LAST_PULL) ?? undefined;
  let pulled = 0;
  try {
    const pullData = await pullFromRemote(since);
    pulled = await mergePullResult(pullData, onProgress);
    localStorage.setItem(STORAGE_KEY_LAST_PULL, syncStartedAt);
  } catch (err) {
    console.error("[sync] pull failed:", err);
  }
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd "D:/My Data/My Apps/LifeScribe Biography"
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/sync-service.ts src-tauri/capabilities/default.json
git commit -m "feat(sync): download media from files.lifescribe.us to local storage; add fullPull option"
```

---

## Task 6: Add "Re-sync everything" button to Settings

This gives the user a one-time way to pull down all existing content (112 photos, all stories with embeds) that predates the last-pull timestamp.

**Files:**
- Modify: `src/pages/settings/SettingsPage.tsx`

- [ ] **Step 1: Add a `handleFullSync` function after `handleSync` (after line 84)**

```typescript
  async function handleFullSync() {
    setSyncing(true);
    setSyncResult(null);
    setSyncStatus("");
    try {
      const result = await syncToRemote((msg) => setSyncStatus(msg), true);
      setSyncResult(result);
      setSyncStatus(`Re-sync complete — ${result.pushed} pushed, ${result.pulled} pulled`);
    } catch (err) {
      setSyncStatus("Re-sync failed: " + String(err));
    } finally {
      setSyncing(false);
    }
  }
```

- [ ] **Step 2: Add the button next to "Sync Now" in the button row (after the Sync Now button, before Disconnect, ~line 178)**

```tsx
                <button
                  onClick={handleFullSync}
                  disabled={syncing}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm border font-medium disabled:opacity-60"
                  style={{ borderColor: "var(--color-primary)", color: "var(--color-primary)" }}
                  title="Pull down all web content, ignoring the last-sync timestamp"
                >
                  <RefreshCw size={13} /> Re-sync everything
                </button>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "D:/My Data/My Apps/LifeScribe Biography"
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/settings/SettingsPage.tsx
git commit -m "feat(settings): add Re-sync everything button for full content re-pull"
```

---

## Task 7: Build and smoke-test

- [ ] **Step 1: Run the desktop dev build**

```bash
cd "D:/My Data/My Apps/LifeScribe Biography"
npm run tauri dev
```

Expected: app launches without compile errors.

- [ ] **Step 2: Trigger a full re-sync**

Settings → Sync → **Re-sync everything**. Watch the status: it should progress through "Downloading photos… N/112". Wait for "Re-sync complete".

- [ ] **Step 3: Verify a story with a Google Maps embed renders**

Stories → "Where I've Lived". An interactive Google Map should now display inline instead of an empty editor.

- [ ] **Step 4: Verify gallery photos display**

Gallery → open an album with web photos. Thumbnails should render as a grid. Click one — the lightbox should show the full-resolution image.

- [ ] **Step 5: Verify locally-created content still works**

Open a story created locally (no embeds) and an album of locally-imported photos. Both should render exactly as before — no regression from the asset-protocol change.

---

## Self-Review

**Spec coverage:**
- [x] Google Maps / YouTube / Vimeo / oEmbed render in desktop ← Tasks 2 + 3 + 4
- [x] Photos download from web to local storage ← Tasks 4 + 5
- [x] Gallery displays synced photos ← AlbumPage already handles `thumbnail_path`; asset protocol enabled in Task 1
- [x] Existing content (created before last sync) gets pulled ← Task 6 full re-pull
- [x] Asset-protocol serving verified before building download pipeline ← Task 1 spike

**Type consistency:**
- `PulledMedia.media_type` (`'image' | 'video'`) matches pull route `m.type.toLowerCase()` ✓
- `downloadMediaFiles(data.media, onProgress)` matches `(mediaItems: PulledMedia[], onProgress?)` ✓
- `syncToRemote(onProgress, fullPull)` matches both call sites (`handleSync` passes 1 arg, `handleFullSync` passes 2) ✓
- `mergePullResult(data, onProgress)` matches updated signature ✓

**Known gaps / follow-up (not blocking):**
- Album `cover_media_id` is not set during sync; GalleryPage shows a generic album icon (it never reads the cover field today, so no regression). A follow-up could set the cover to the first synced photo.
- Videos: `thumbnail_path` points at an `.mp4`, so `<img>` in AlbumPage shows a broken image for video rows. Production is almost entirely images; video thumbnail extraction is deferred (YAGNI).
- No deletion sync: media deleted on the web is not removed locally. Out of scope.
