# Reader Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-screen, read-only "Reader Mode" to the desktop app — a polished way to experience the biography (Cover, Stories, Timeline, Gallery, Family Tree, Career, Maps), entered via a "Read My Biography" button on the Overview page.

**Architecture:** A new `/reader` route tree renders its own persistent sidebar (`ReaderShell` + `ReaderSidebar`) instead of the normal `AppShell`, selected by a small conditional in the root route component based on URL prefix. Each section reuses existing display logic — `StoryEditor readOnly` for stories, a newly-extracted `AlbumGrid` component for photos/video, and stripped-down copies of the Timeline/Family/Career/Maps display logic — with all "Add/Edit/Delete" UI removed.

**Tech Stack:** React 19, TypeScript, TanStack Router (code-based route tree), Tailwind, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-29-reader-mode-design.md`

---

## Design notes that bind the whole plan

- **Route nesting is new to this codebase** (today all routes are flat children of `rootRoute`). `/reader` uses real parent/child nesting (`readerRoute` → its 9 section routes) so they share one persistent sidebar through a single `<Outlet/>`. This is standard TanStack Router behavior for code-based route trees, not a hack.
- **Route full-path IDs**, used as the `from` string in `useParams({ from: ... })`, are the parent's path + the child's relative path: `readerRoute` (`/reader`) + child `/stories/$storyId` → `/reader/stories/$storyId`. If a `tsc` check ever reports an invalid `from` string, TypeScript's error message lists the exact valid route ids — use the one it shows.
- **Task 2 registers every Reader route up front** (with placeholder page components for everything except the Cover page), so later tasks only ever edit an existing file's content rather than touching routing again.
- Every reader page strips *mutation* UI (Add/Edit/Delete/Import) but keeps all *display* interactions (lightbox, map pan/zoom, opening a story).
- Run all commands from `D:/My Data/My Apps/LifeScribe Biography`. Repo uses **pnpm**; `npx tsc`/`npx vitest` work regardless of package manager.

## File Structure

### Create
- `src/lib/reader-utils.ts` — pure helpers: `isBiographyEmpty`, `filterPublishedStories`
- `src/lib/reader-utils.test.ts`
- `src/components/reader/ReaderSidebar.tsx` — persistent Reader Mode nav
- `src/components/gallery/AlbumGrid.tsx` — extracted grid + lightbox (+ video playback), shared by editor and reader
- `src/pages/reader/ReaderShell.tsx` — full-screen container (sidebar + outlet)
- `src/pages/reader/ReaderCoverPage.tsx`
- `src/pages/reader/ReaderStoriesPage.tsx`, `ReaderStoryPage.tsx`
- `src/pages/reader/ReaderTimelinePage.tsx`
- `src/pages/reader/ReaderGalleryPage.tsx`, `ReaderAlbumPage.tsx`
- `src/pages/reader/ReaderFamilyTreePage.tsx`
- `src/pages/reader/ReaderCareerPage.tsx`
- `src/pages/reader/ReaderMapsPage.tsx`

### Modify
- `src/routes/index.tsx` — add the `/reader/*` route tree; root component switches between `AppShell` and plain `Outlet`
- `src/pages/OverviewPage.tsx` — add "Read My Biography" entry point
- `src/pages/gallery/AlbumPage.tsx` — refactored to use the new shared `AlbumGrid`

---

## Task 1: Pure reader utilities (TDD)

**Files:**
- Create: `src/lib/reader-utils.ts`
- Create: `src/lib/reader-utils.test.ts`

- [ ] **Step 1: Write the failing tests `src/lib/reader-utils.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { isBiographyEmpty, filterPublishedStories } from "./reader-utils";
import type { Story } from "./models";

describe("isBiographyEmpty", () => {
  it("returns true when every count is zero", () => {
    expect(
      isBiographyEmpty({
        storyCount: 0, milestoneCount: 0, mediaCount: 0,
        familyMemberCount: 0, careerCount: 0, mapPinCount: 0,
      })
    ).toBe(true);
  });

  it("returns false when any single count is non-zero", () => {
    expect(
      isBiographyEmpty({
        storyCount: 1, milestoneCount: 0, mediaCount: 0,
        familyMemberCount: 0, careerCount: 0, mapPinCount: 0,
      })
    ).toBe(false);
    expect(
      isBiographyEmpty({
        storyCount: 0, milestoneCount: 0, mediaCount: 0,
        familyMemberCount: 0, careerCount: 0, mapPinCount: 3,
      })
    ).toBe(false);
  });
});

function story(overrides: Partial<Story>): Story {
  return {
    id: 1, title: "T", slug: null, content: null, excerpt: null,
    status: "draft", event_date: null, event_date_precision: "day",
    featured_image_path: null, view_count: 0,
    created_at: "2026-01-01", updated_at: "2026-01-01",
    ...overrides,
  };
}

describe("filterPublishedStories", () => {
  it("keeps only published stories", () => {
    const stories = [
      story({ id: 1, status: "published" }),
      story({ id: 2, status: "draft" }),
      story({ id: 3, status: "published" }),
    ];
    const result = filterPublishedStories(stories);
    expect(result.map((s) => s.id)).toEqual([1, 3]);
  });

  it("returns an empty array when nothing is published", () => {
    expect(filterPublishedStories([story({ status: "draft" })])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/reader-utils.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/lib/reader-utils.ts`**

```typescript
import type { Story } from "./models";

export interface BiographyStats {
  storyCount: number;
  milestoneCount: number;
  mediaCount: number;
  familyMemberCount: number;
  careerCount: number;
  mapPinCount: number;
}

/** True when there is nothing anywhere in the biography to read yet. */
export function isBiographyEmpty(stats: BiographyStats): boolean {
  return (
    stats.storyCount === 0 &&
    stats.milestoneCount === 0 &&
    stats.mediaCount === 0 &&
    stats.familyMemberCount === 0 &&
    stats.careerCount === 0 &&
    stats.mapPinCount === 0
  );
}

/** Defensive filter so Reader Mode can never show an unpublished story. */
export function filterPublishedStories(stories: Story[]): Story[] {
  return stories.filter((s) => s.status === "published");
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/reader-utils.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reader-utils.ts src/lib/reader-utils.test.ts
git commit -m "feat(reader): add pure reader utility functions"
```

---

## Task 2: Reader Mode skeleton — routes, shell, sidebar, Cover page, entry point

This task makes Reader Mode fully navigable end-to-end: clicking "Read My Biography" opens a full-screen Cover page with a working sidebar; every other section shows a "Coming soon" placeholder until later tasks fill them in.

**Files:**
- Create: `src/components/reader/ReaderSidebar.tsx`
- Create: `src/pages/reader/ReaderShell.tsx`
- Create: `src/pages/reader/ReaderCoverPage.tsx`
- Create: `src/pages/reader/ReaderStoriesPage.tsx` (placeholder)
- Create: `src/pages/reader/ReaderStoryPage.tsx` (placeholder)
- Create: `src/pages/reader/ReaderTimelinePage.tsx` (placeholder)
- Create: `src/pages/reader/ReaderGalleryPage.tsx` (placeholder)
- Create: `src/pages/reader/ReaderAlbumPage.tsx` (placeholder)
- Create: `src/pages/reader/ReaderFamilyTreePage.tsx` (placeholder)
- Create: `src/pages/reader/ReaderCareerPage.tsx` (placeholder)
- Create: `src/pages/reader/ReaderMapsPage.tsx` (placeholder)
- Modify: `src/routes/index.tsx`
- Modify: `src/pages/OverviewPage.tsx`

- [ ] **Step 1: Create `src/components/reader/ReaderSidebar.tsx`**

```tsx
import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

interface ReaderNavItem {
  label: string;
  path:
    | "/reader"
    | "/reader/stories"
    | "/reader/timeline"
    | "/reader/gallery"
    | "/reader/family-tree"
    | "/reader/career"
    | "/reader/maps";
}

const READER_NAV_ITEMS: ReaderNavItem[] = [
  { label: "Cover", path: "/reader" },
  { label: "Stories", path: "/reader/stories" },
  { label: "Timeline", path: "/reader/timeline" },
  { label: "Gallery", path: "/reader/gallery" },
  { label: "Family Tree", path: "/reader/family-tree" },
  { label: "Career", path: "/reader/career" },
  { label: "Maps", path: "/reader/maps" },
];

export default function ReaderSidebar() {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  function isActive(item: ReaderNavItem): boolean {
    if (item.path === "/reader") return currentPath === "/reader";
    return currentPath === item.path || currentPath.startsWith(item.path + "/");
  }

  return (
    <aside
      className="flex flex-col h-full w-56 flex-shrink-0"
      style={{ background: "var(--color-sidebar-bg)" }}
    >
      <div className="px-5 py-5 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <Link
          to="/"
          className="flex items-center gap-1.5 text-xs"
          style={{ color: "var(--color-sidebar-text)", opacity: 0.7 }}
        >
          <ArrowLeft size={12} />
          Exit Reader
        </Link>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {READER_NAV_ITEMS.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.path}
              to={item.path}
              className="block px-3 py-2 rounded-lg text-sm transition-colors"
              style={{
                color: active ? "var(--color-sidebar-text-active)" : "var(--color-sidebar-text)",
                background: active ? "var(--color-sidebar-active-bg)" : "transparent",
                fontWeight: active ? 500 : 400,
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Create `src/pages/reader/ReaderShell.tsx`**

```tsx
import { Outlet } from "@tanstack/react-router";
import ReaderSidebar from "@/components/reader/ReaderSidebar";

export default function ReaderShell() {
  return (
    <div className="flex h-full overflow-hidden" style={{ background: "var(--color-background)" }}>
      <ReaderSidebar />
      <main className="flex-1 overflow-y-auto" style={{ background: "var(--color-background)" }}>
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/pages/reader/ReaderCoverPage.tsx`**

```tsx
import { useEffect, useState } from "react";
import { getBiography, getBiographyStats } from "@/lib/actions/biography";
import { localFileUrl } from "@/lib/db";
import { isBiographyEmpty } from "@/lib/reader-utils";
import type { Biography } from "@/lib/models";

interface Stats {
  storyCount: number;
  milestoneCount: number;
  mediaCount: number;
  albumCount: number;
  familyMemberCount: number;
  careerCount: number;
  mapPinCount: number;
}

export default function ReaderCoverPage() {
  const [bio, setBio] = useState<Biography | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    Promise.all([getBiography(), getBiographyStats()]).then(([b, s]) => {
      setBio(b);
      setStats(s);
    });
  }, []);

  if (!bio || !stats) {
    return (
      <div className="p-8 text-sm" style={{ color: "var(--color-text-muted)" }}>
        Loading…
      </div>
    );
  }

  const backgroundImage = bio.cover_photo_path
    ? localFileUrl(bio.cover_photo_path)
    : bio.avatar_photo_path
      ? localFileUrl(bio.avatar_photo_path)
      : null;

  const empty = isBiographyEmpty(stats);

  return (
    <div
      className="min-h-full flex flex-col items-center justify-center text-center px-8"
      style={{
        background: backgroundImage
          ? `linear-gradient(rgba(20,16,12,0.55), rgba(20,16,12,0.55)), url(${backgroundImage}) center/cover no-repeat`
          : "linear-gradient(135deg, #2b2620, #4a4038)",
        color: "#f5f0e8",
      }}
    >
      <h1 className="text-4xl mb-3" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.5px" }}>
        {bio.title}
      </h1>
      {bio.tagline && <p className="text-base opacity-85 max-w-lg">{bio.tagline}</p>}
      <p className="text-xs mt-10 opacity-60">
        {empty
          ? "Nothing to read yet — add stories, photos, and milestones from the editor."
          : "↓ choose a section from the left to begin reading"}
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Create the 8 placeholder pages**

Each of these files gets the same minimal content (adjust the export name to match the filename):

`src/pages/reader/ReaderStoriesPage.tsx`, `ReaderStoryPage.tsx`, `ReaderTimelinePage.tsx`, `ReaderGalleryPage.tsx`, `ReaderAlbumPage.tsx`, `ReaderFamilyTreePage.tsx`, `ReaderCareerPage.tsx`, `ReaderMapsPage.tsx`:

```tsx
export default function ReaderStoriesPage() {
  return (
    <div className="p-8 text-sm" style={{ color: "var(--color-text-muted)" }}>
      Coming soon.
    </div>
  );
}
```

(Repeat for each file, renaming the function to match: `ReaderStoryPage`, `ReaderTimelinePage`, `ReaderGalleryPage`, `ReaderAlbumPage`, `ReaderFamilyTreePage`, `ReaderCareerPage`, `ReaderMapsPage`.)

- [ ] **Step 5: Replace `src/routes/index.tsx` with this full content**

```tsx
import { createRouter, createRoute, createRootRoute, Outlet, useRouterState } from "@tanstack/react-router";
import AppShell from "@/components/layout/AppShell";

// Pages
import OverviewPage from "@/pages/OverviewPage";
import StoryListPage from "@/pages/stories/StoryListPage";
import StoryEditorPage from "@/pages/stories/StoryEditorPage";
import NewStoryPage from "@/pages/stories/NewStoryPage";
import TimelinePage from "@/pages/timeline/TimelinePage";
import GalleryPage from "@/pages/gallery/GalleryPage";
import AlbumPage from "@/pages/gallery/AlbumPage";
import FamilyTreePage from "@/pages/family-tree/FamilyTreePage";
import CareerPage from "@/pages/career/CareerPage";
import MapsPage from "@/pages/maps/MapsPage";
import ImportHubPage from "@/pages/import/ImportHubPage";
import PhotoImportPage from "@/pages/import/PhotoImportPage";
import ArchiveImportPage from "@/pages/import/ArchiveImportPage";
import ReviewPage from "@/pages/import/ReviewPage";
import SettingsPage from "@/pages/settings/SettingsPage";

// Reader pages
import ReaderShell from "@/pages/reader/ReaderShell";
import ReaderCoverPage from "@/pages/reader/ReaderCoverPage";
import ReaderStoriesPage from "@/pages/reader/ReaderStoriesPage";
import ReaderStoryPage from "@/pages/reader/ReaderStoryPage";
import ReaderTimelinePage from "@/pages/reader/ReaderTimelinePage";
import ReaderGalleryPage from "@/pages/reader/ReaderGalleryPage";
import ReaderAlbumPage from "@/pages/reader/ReaderAlbumPage";
import ReaderFamilyTreePage from "@/pages/reader/ReaderFamilyTreePage";
import ReaderCareerPage from "@/pages/reader/ReaderCareerPage";
import ReaderMapsPage from "@/pages/reader/ReaderMapsPage";

// Root route — wraps editor routes in AppShell; Reader Mode routes render
// full-screen with their own chrome (ReaderShell), so the root component
// switches based on the current path.
function RootComponent() {
  const routerState = useRouterState();
  const isReader = routerState.location.pathname.startsWith("/reader");

  if (isReader) {
    return <Outlet />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

const rootRoute = createRootRoute({
  component: RootComponent,
});

const overviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: OverviewPage,
});

// Stories
const storiesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/stories",
  component: StoryListPage,
});
const newStoryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/stories/new",
  component: NewStoryPage,
});
const storyEditorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/stories/$storyId",
  component: StoryEditorPage,
});

// Timeline
const timelineRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/timeline",
  component: TimelinePage,
});

// Gallery
const galleryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/gallery",
  component: GalleryPage,
});
const albumRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/gallery/albums/$albumId",
  component: AlbumPage,
});

// Family Tree
const familyTreeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/family-tree",
  component: FamilyTreePage,
});

// Career
const careerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/career",
  component: CareerPage,
});

// Maps
const mapsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/maps",
  component: MapsPage,
});

// Import
const importHubRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/import",
  component: ImportHubPage,
});
const photoImportRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/import/photos",
  component: PhotoImportPage,
});
const archiveImportRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/import/archive",
  component: ArchiveImportPage,
});
const reviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/import/review",
  component: ReviewPage,
});

// Settings
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
});

// Reader Mode — full-screen read-only presentation. readerRoute owns the
// persistent sidebar (via ReaderShell); every section below is a child so
// they share it through a single <Outlet/>.
const readerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/reader",
  component: ReaderShell,
});
const readerCoverRoute = createRoute({
  getParentRoute: () => readerRoute,
  path: "/",
  component: ReaderCoverPage,
});
const readerStoriesRoute = createRoute({
  getParentRoute: () => readerRoute,
  path: "/stories",
  component: ReaderStoriesPage,
});
const readerStoryRoute = createRoute({
  getParentRoute: () => readerRoute,
  path: "/stories/$storyId",
  component: ReaderStoryPage,
});
const readerTimelineRoute = createRoute({
  getParentRoute: () => readerRoute,
  path: "/timeline",
  component: ReaderTimelinePage,
});
const readerGalleryRoute = createRoute({
  getParentRoute: () => readerRoute,
  path: "/gallery",
  component: ReaderGalleryPage,
});
const readerAlbumRoute = createRoute({
  getParentRoute: () => readerRoute,
  path: "/gallery/albums/$albumId",
  component: ReaderAlbumPage,
});
const readerFamilyTreeRoute = createRoute({
  getParentRoute: () => readerRoute,
  path: "/family-tree",
  component: ReaderFamilyTreePage,
});
const readerCareerRoute = createRoute({
  getParentRoute: () => readerRoute,
  path: "/career",
  component: ReaderCareerPage,
});
const readerMapsRoute = createRoute({
  getParentRoute: () => readerRoute,
  path: "/maps",
  component: ReaderMapsPage,
});

const readerRouteWithChildren = readerRoute.addChildren([
  readerCoverRoute,
  readerStoriesRoute,
  readerStoryRoute,
  readerTimelineRoute,
  readerGalleryRoute,
  readerAlbumRoute,
  readerFamilyTreeRoute,
  readerCareerRoute,
  readerMapsRoute,
]);

const routeTree = rootRoute.addChildren([
  overviewRoute,
  storiesRoute,
  newStoryRoute,
  storyEditorRoute,
  timelineRoute,
  galleryRoute,
  albumRoute,
  familyTreeRoute,
  careerRoute,
  mapsRoute,
  importHubRoute,
  photoImportRoute,
  archiveImportRoute,
  reviewRoute,
  settingsRoute,
  readerRouteWithChildren,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
```

- [ ] **Step 6: Add the entry point to `src/pages/OverviewPage.tsx`**

Change the lucide-react import line from:
```typescript
import { BookOpen, Clock, Image, Users, Briefcase, MapPin, Download } from "lucide-react";
```
to:
```typescript
import { BookOpen, Clock, Image, Users, Briefcase, MapPin, Download, Eye } from "lucide-react";
```

Then, in the returned JSX, find this exact block (the end of the page header):
```tsx
        <p style={{ color: "var(--color-text-secondary)" }}>
          Everything that makes you, you — captured and preserved.
        </p>
      </div>

      {/* Stat cards */}
```
Insert a new block between the header's closing `</div>` and the `{/* Stat cards */}` comment, so it reads:
```tsx
        <p style={{ color: "var(--color-text-secondary)" }}>
          Everything that makes you, you — captured and preserved.
        </p>
      </div>

      {/* Reader Mode entry point */}
      <Link
        to="/reader"
        className="flex items-center gap-4 p-6 rounded-xl border mb-8 transition-shadow hover:shadow-md"
        style={{
          background: "var(--color-surface)",
          borderColor: "var(--color-primary)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div
          className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--color-primary)" }}
        >
          <Eye size={20} color="white" />
        </div>
        <div>
          <div className="text-base font-semibold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
            Read My Biography
          </div>
          <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            See your life story the way a visitor would experience it
          </div>
        </div>
      </Link>

      {/* Stat cards */}
```

- [ ] **Step 7: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors. If TypeScript reports that a `from` string in a later task doesn't match a registered route id, its error message lists the valid id — use that.

- [ ] **Step 8: Manually verify the skeleton**

Run: `pnpm tauri dev`
- Open the app, go to Overview, click "Read My Biography".
- Expected: full-screen Cover page with your title/tagline over a background image (or gradient if no cover/avatar photo is set), a left sidebar listing Cover/Stories/Timeline/Gallery/Family Tree/Career/Maps, and "← Exit Reader" at the top.
- Click each sidebar item — Cover works fully; the other 6 show "Coming soon."
- Click "Exit Reader" — returns to the normal Overview page with the regular app sidebar.

- [ ] **Step 9: Commit**

```bash
git add src/components/reader/ReaderSidebar.tsx src/pages/reader/ src/routes/index.tsx src/pages/OverviewPage.tsx
git commit -m "feat(reader): add Reader Mode skeleton — routes, shell, sidebar, Cover page"
```

---

## Task 3: Extract shared `AlbumGrid` component

Pulls the grid + lightbox (+ video playback) out of `AlbumPage` into a reusable component, so both the editor's album view and the reader's gallery view render from one source. This is a behavior-preserving refactor — `AlbumPage` should look and work identically afterward.

**Files:**
- Create: `src/components/gallery/AlbumGrid.tsx`
- Modify: `src/pages/gallery/AlbumPage.tsx`

- [ ] **Step 1: Create `src/components/gallery/AlbumGrid.tsx`**

```tsx
import { useEffect, useState } from "react";
import { Image, X, ChevronLeft, ChevronRight, Play } from "lucide-react";
import { localFileUrl } from "@/lib/db";
import type { Media } from "@/lib/models";

interface AlbumGridProps {
  photos: Media[];
  emptyMessage?: string;
}

export default function AlbumGrid({ photos, emptyMessage = "No photos in this album." }: AlbumGridProps) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  useEffect(() => {
    if (lightboxIdx === null) return;
    function onKey(e: KeyboardEvent) {
      if (lightboxIdx === null) return;
      if (e.key === "Escape") setLightboxIdx(null);
      if (e.key === "ArrowLeft") setLightboxIdx((i) => (i === null || i === 0 ? photos.length - 1 : i - 1));
      if (e.key === "ArrowRight") setLightboxIdx((i) => (i === null ? 0 : (i + 1) % photos.length));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIdx, photos.length]);

  const lightboxPhoto = lightboxIdx !== null ? photos[lightboxIdx] : null;

  if (photos.length === 0) {
    return (
      <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-4 gap-3">
        {photos.map((photo, idx) => (
          <button
            key={photo.id}
            onClick={() => setLightboxIdx(idx)}
            className="relative aspect-square rounded-lg overflow-hidden border hover:opacity-90 transition-opacity"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface-2)" }}
          >
            {photo.thumbnail_path ? (
              <img
                src={localFileUrl(photo.thumbnail_path)}
                alt={photo.title ?? photo.filename}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Image size={20} style={{ color: "var(--color-text-muted)" }} />
              </div>
            )}
            {photo.source_url && (
              <span className="absolute inset-0 flex items-center justify-center">
                <span
                  className="flex items-center justify-center w-10 h-10 rounded-full"
                  style={{ background: "rgba(0,0,0,0.55)" }}
                >
                  <Play size={18} fill="white" style={{ color: "white" }} />
                </span>
              </span>
            )}
          </button>
        ))}
      </div>

      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.9)" }}
          onClick={() => setLightboxIdx(null)}
        >
          <button
            className="absolute top-4 right-4 z-10 p-2 rounded-full"
            style={{ background: "rgba(255,255,255,0.1)", color: "white" }}
            onClick={(e) => { e.stopPropagation(); setLightboxIdx(null); }}
          >
            <X size={18} />
          </button>

          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full"
            style={{ background: "rgba(255,255,255,0.1)", color: "white" }}
            onClick={(e) => { e.stopPropagation(); setLightboxIdx((i) => (i === null || i === 0 ? photos.length - 1 : i - 1)); }}
          >
            <ChevronLeft size={22} />
          </button>

          <div className="max-w-5xl max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            {lightboxPhoto.source_url ? (
              <iframe
                src={lightboxPhoto.source_url}
                title={lightboxPhoto.title ?? lightboxPhoto.filename}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="rounded-lg"
                style={{ width: "min(90vw, 960px)", aspectRatio: "16 / 9", border: 0 }}
              />
            ) : (
              <img
                src={localFileUrl(lightboxPhoto.file_path)}
                alt={lightboxPhoto.title ?? lightboxPhoto.filename}
                className="max-w-full max-h-[80vh] object-contain rounded-lg"
              />
            )}
            {(lightboxPhoto.title || lightboxPhoto.caption) && (
              <div className="mt-3 text-center">
                {lightboxPhoto.title && (
                  <div className="font-medium text-sm" style={{ color: "white" }}>{lightboxPhoto.title}</div>
                )}
                {lightboxPhoto.caption && (
                  <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.7)" }}>{lightboxPhoto.caption}</div>
                )}
              </div>
            )}
            <div className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.4)" }}>
              {(lightboxIdx ?? 0) + 1} / {photos.length}
            </div>
          </div>

          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full"
            style={{ background: "rgba(255,255,255,0.1)", color: "white" }}
            onClick={(e) => { e.stopPropagation(); setLightboxIdx((i) => (i === null ? 0 : (i + 1) % photos.length)); }}
          >
            <ChevronRight size={22} />
          </button>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Replace `src/pages/gallery/AlbumPage.tsx` with this content**

```tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import AlbumGrid from "@/components/gallery/AlbumGrid";
import { getAlbum, listMedia } from "@/lib/actions/gallery";
import type { Album, Media } from "@/lib/models";

export default function AlbumPage() {
  const { albumId } = useParams({ from: "/gallery/albums/$albumId" });
  const navigate = useNavigate();
  const [album, setAlbum] = useState<Album | null>(null);
  const [photos, setPhotos] = useState<Media[]>([]);

  useEffect(() => {
    const id = Number(albumId);
    Promise.all([getAlbum(id), listMedia({ album_id: id })]).then(([a, m]) => {
      setAlbum(a);
      setPhotos(m);
    });
  }, [albumId]);

  return (
    <div className="p-8">
      <button
        onClick={() => navigate({ to: "/gallery" })}
        className="flex items-center gap-1.5 text-sm mb-6"
        style={{ color: "var(--color-text-secondary)" }}
      >
        <ArrowLeft size={14} />
        Gallery
      </button>

      <h1 className="text-2xl mb-6" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
        {album?.name ?? "Album"}
      </h1>

      <AlbumGrid photos={photos} />
    </div>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manually verify no regression**

Run: `pnpm tauri dev`, open Gallery → an album with photos and (if you have one) a video. Confirm: grid displays, clicking a photo opens the lightbox, arrow keys/buttons navigate, Escape/click-outside closes it, and a video still plays inline. This must look identical to before the refactor.

- [ ] **Step 5: Commit**

```bash
git add src/components/gallery/AlbumGrid.tsx src/pages/gallery/AlbumPage.tsx
git commit -m "refactor(gallery): extract AlbumGrid component from AlbumPage"
```

---

## Task 4: Stories section — real content

**Files:**
- Modify: `src/pages/reader/ReaderStoriesPage.tsx`
- Modify: `src/pages/reader/ReaderStoryPage.tsx`

- [ ] **Step 1: Replace `src/pages/reader/ReaderStoriesPage.tsx` with this content**

```tsx
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { listStories } from "@/lib/actions/stories";
import { filterPublishedStories } from "@/lib/reader-utils";
import type { Story } from "@/lib/models";

export default function ReaderStoriesPage() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listStories({ status: "published" })
      .then((s) => setStories(filterPublishedStories(s)))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl mb-6" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
        Stories
      </h1>

      {loading ? (
        <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>
      ) : stories.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={24} style={{ color: "var(--color-text-muted)" }} />}
          title="No published stories yet"
          description="Published stories will appear here."
        />
      ) : (
        <div className="space-y-3">
          {stories.map((story) => (
            <Link
              key={story.id}
              to="/reader/stories/$storyId"
              params={{ storyId: String(story.id) }}
              className="block p-5 rounded-xl border hover:shadow-md transition-shadow"
              style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}
            >
              <h3 className="font-semibold text-base mb-1" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
                {story.title}
              </h3>
              {story.excerpt && (
                <p className="text-sm line-clamp-2" style={{ color: "var(--color-text-secondary)" }}>{story.excerpt}</p>
              )}
              {story.event_date && (
                <span className="text-xs mt-2 inline-block" style={{ color: "var(--color-text-muted)" }}>
                  {story.event_date.substring(0, story.event_date_precision === "year" ? 4 : story.event_date_precision === "month" ? 7 : 10)}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Replace `src/pages/reader/ReaderStoryPage.tsx` with this content**

```tsx
import { useEffect, useState } from "react";
import { useParams, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import StoryEditor from "@/components/editor/StoryEditor";
import { getStory } from "@/lib/actions/stories";
import type { Story } from "@/lib/models";

export default function ReaderStoryPage() {
  const { storyId } = useParams({ from: "/reader/stories/$storyId" });
  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStory(Number(storyId)).then(setStory).catch(console.error).finally(() => setLoading(false));
  }, [storyId]);

  if (loading) {
    return <div className="p-8 text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>;
  }
  if (!story || story.status !== "published") {
    return <div className="p-8 text-sm" style={{ color: "var(--color-error)" }}>Story not found.</div>;
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link
        to="/reader/stories"
        className="flex items-center gap-1.5 text-sm mb-6"
        style={{ color: "var(--color-text-secondary)" }}
      >
        <ArrowLeft size={14} />
        Stories
      </Link>
      <h1 className="text-2xl mb-1" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
        {story.title}
      </h1>
      {story.event_date && (
        <div className="text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
          {story.event_date.substring(0, story.event_date_precision === "year" ? 4 : story.event_date_precision === "month" ? 7 : 10)}
        </div>
      )}
      <StoryEditor content={story.content} onChange={() => {}} readOnly />
    </div>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors. (If the `from` string in `useParams` is flagged, use the exact id TypeScript's error message shows.)

- [ ] **Step 4: Manually verify**

Run: `pnpm tauri dev`. In Reader Mode, open Stories — published stories list (no unpublished ones), click one — opens the full read view with no editor toolbar, embeds/images render.

- [ ] **Step 5: Commit**

```bash
git add src/pages/reader/ReaderStoriesPage.tsx src/pages/reader/ReaderStoryPage.tsx
git commit -m "feat(reader): implement Stories section"
```

---

## Task 5: Timeline section — real content

**Files:**
- Modify: `src/pages/reader/ReaderTimelinePage.tsx`

- [ ] **Step 1: Replace `src/pages/reader/ReaderTimelinePage.tsx` with this content**

```tsx
import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { listMilestones } from "@/lib/actions/milestones";
import type { Milestone } from "@/lib/models";

function formatDate(date: string, precision: string) {
  if (precision === "year") return date.substring(0, 4);
  if (precision === "month") return date.substring(0, 7);
  return date.substring(0, 10);
}

export default function ReaderTimelinePage() {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listMilestones().then(setMilestones).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl mb-6" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
        Timeline
      </h1>

      {loading ? (
        <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>
      ) : milestones.length === 0 ? (
        <EmptyState
          icon={<Clock size={24} style={{ color: "var(--color-text-muted)" }} />}
          title="No milestones yet"
          description="Milestones will appear here once added."
        />
      ) : (
        <div className="relative pl-8 max-w-2xl">
          <div className="absolute left-3 top-0 bottom-0 w-0.5" style={{ background: "var(--color-border)" }} />
          <div className="space-y-6">
            {milestones.map((m) => (
              <div key={m.id} className="relative">
                <div
                  className="absolute -left-8 top-3 w-4 h-4 rounded-full border-2 border-white"
                  style={{ background: m.color || "var(--color-primary)" }}
                />
                <div
                  className="p-4 rounded-xl border"
                  style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
                        {m.title}
                      </h3>
                      {m.description && (
                        <p className="text-sm mt-0.5" style={{ color: "var(--color-text-secondary)" }}>{m.description}</p>
                      )}
                      {m.category && (
                        <span className="inline-block text-xs mt-1 px-2 py-0.5 rounded-full" style={{ background: "var(--color-surface-2)", color: "var(--color-text-muted)" }}>
                          {m.category}
                        </span>
                      )}
                    </div>
                    <span className="text-xs flex-shrink-0" style={{ color: "var(--color-text-muted)" }}>
                      {formatDate(m.date, m.date_precision)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manually verify**

Run: `pnpm tauri dev`. In Reader Mode, open Timeline — milestones shown chronologically, no Add button, no Edit/Delete icons.

- [ ] **Step 4: Commit**

```bash
git add src/pages/reader/ReaderTimelinePage.tsx
git commit -m "feat(reader): implement Timeline section"
```

---

## Task 6: Gallery section — real content

**Files:**
- Modify: `src/pages/reader/ReaderGalleryPage.tsx`
- Modify: `src/pages/reader/ReaderAlbumPage.tsx`

- [ ] **Step 1: Replace `src/pages/reader/ReaderGalleryPage.tsx` with this content**

```tsx
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Image } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { listAlbums } from "@/lib/actions/gallery";
import { localFileUrl } from "@/lib/db";
import type { Album } from "@/lib/models";

export default function ReaderGalleryPage() {
  const [albums, setAlbums] = useState<(Album & { media_count: number; cover_path: string | null })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listAlbums().then(setAlbums).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl mb-6" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
        Gallery
      </h1>

      {loading ? (
        <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>
      ) : albums.length === 0 ? (
        <EmptyState
          icon={<Image size={24} style={{ color: "var(--color-text-muted)" }} />}
          title="No photos yet"
          description="Photo albums will appear here once added."
        />
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {albums.map((album) => (
            <Link
              key={album.id}
              to="/reader/gallery/albums/$albumId"
              params={{ albumId: String(album.id) }}
              className="block rounded-xl overflow-hidden border hover:shadow-md transition-shadow"
              style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
            >
              <div className="aspect-video flex items-center justify-center overflow-hidden" style={{ background: "var(--color-surface-2)" }}>
                {album.cover_path ? (
                  <img src={localFileUrl(album.cover_path)} alt={album.name} className="w-full h-full object-cover" />
                ) : (
                  <Image size={32} style={{ color: "var(--color-text-muted)" }} />
                )}
              </div>
              <div className="p-3">
                <div className="font-medium text-sm" style={{ color: "var(--color-text)" }}>{album.name}</div>
                <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                  {album.media_count} photo{album.media_count !== 1 ? "s" : ""}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Replace `src/pages/reader/ReaderAlbumPage.tsx` with this content**

```tsx
import { useEffect, useState } from "react";
import { useParams, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import AlbumGrid from "@/components/gallery/AlbumGrid";
import { getAlbum, listMedia } from "@/lib/actions/gallery";
import type { Album, Media } from "@/lib/models";

export default function ReaderAlbumPage() {
  const { albumId } = useParams({ from: "/reader/gallery/albums/$albumId" });
  const [album, setAlbum] = useState<Album | null>(null);
  const [photos, setPhotos] = useState<Media[]>([]);

  useEffect(() => {
    const id = Number(albumId);
    Promise.all([getAlbum(id), listMedia({ album_id: id })]).then(([a, m]) => {
      setAlbum(a);
      setPhotos(m);
    });
  }, [albumId]);

  return (
    <div className="p-8">
      <Link
        to="/reader/gallery"
        className="flex items-center gap-1.5 text-sm mb-6"
        style={{ color: "var(--color-text-secondary)" }}
      >
        <ArrowLeft size={14} />
        Gallery
      </Link>

      <h1 className="text-2xl mb-6" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
        {album?.name ?? "Album"}
      </h1>

      <AlbumGrid photos={photos} />
    </div>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors. (If the `from` string is flagged, use the exact id TypeScript's error message shows.)

- [ ] **Step 4: Manually verify**

Run: `pnpm tauri dev`. In Reader Mode, open Gallery — album grid with covers, click one — same grid/lightbox/video-play behavior as the editor's album view, no Import button.

- [ ] **Step 5: Commit**

```bash
git add src/pages/reader/ReaderGalleryPage.tsx src/pages/reader/ReaderAlbumPage.tsx
git commit -m "feat(reader): implement Gallery section"
```

---

## Task 7: Family Tree section — real content

**Files:**
- Modify: `src/pages/reader/ReaderFamilyTreePage.tsx`

- [ ] **Step 1: Replace `src/pages/reader/ReaderFamilyTreePage.tsx` with this content**

```tsx
import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { listFamilyMembers } from "@/lib/actions/family-tree";
import { localFileUrl } from "@/lib/db";
import type { FamilyMember } from "@/lib/models";

export default function ReaderFamilyTreePage() {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listFamilyMembers().then(setMembers).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl mb-6" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
        Family Tree
      </h1>

      {loading ? (
        <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>
      ) : members.length === 0 ? (
        <EmptyState
          icon={<Users size={24} style={{ color: "var(--color-text-muted)" }} />}
          title="No family members yet"
          description="Family members will appear here once added."
        />
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {members.map((m) => (
            <div key={m.id} className="p-4 rounded-xl border" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-start gap-3">
                {m.photo_path ? (
                  <img src={localFileUrl(m.photo_path)} alt={m.given_name} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold text-white flex-shrink-0" style={{ background: "var(--color-primary)" }}>
                    {m.given_name[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm" style={{ color: "var(--color-text)" }}>
                    {m.given_name} {m.surname ?? ""}
                  </div>
                  {m.birth_date && (
                    <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                      b. {m.birth_date.substring(0, 4)}{m.death_date ? ` — d. ${m.death_date.substring(0, 4)}` : ""}
                    </div>
                  )}
                  {m.birth_place && <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>{m.birth_place}</div>}
                </div>
              </div>
              {m.bio && <p className="text-xs mt-2" style={{ color: "var(--color-text-secondary)" }}>{m.bio}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manually verify**

Run: `pnpm tauri dev`. In Reader Mode, open Family Tree — member cards display, no Add/Edit/Delete controls.

- [ ] **Step 4: Commit**

```bash
git add src/pages/reader/ReaderFamilyTreePage.tsx
git commit -m "feat(reader): implement Family Tree section"
```

---

## Task 8: Career section — real content

**Files:**
- Modify: `src/pages/reader/ReaderCareerPage.tsx`

- [ ] **Step 1: Replace `src/pages/reader/ReaderCareerPage.tsx` with this content**

```tsx
import { useEffect, useState } from "react";
import { Briefcase, GraduationCap } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { listCareerEntries } from "@/lib/actions/career";
import type { CareerEntry } from "@/lib/models";

export default function ReaderCareerPage() {
  const [entries, setEntries] = useState<CareerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listCareerEntries().then(setEntries).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl mb-6" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
        Career &amp; Education
      </h1>

      {loading ? (
        <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<Briefcase size={24} style={{ color: "var(--color-text-muted)" }} />}
          title="No career entries yet"
          description="Career and education entries will appear here once added."
        />
      ) : (
        <div className="space-y-3 max-w-2xl">
          {entries.map((entry) => {
            const Icon = entry.entry_type === "education" ? GraduationCap : Briefcase;
            return (
              <div key={entry.id} className="p-5 rounded-xl border flex items-start gap-4" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "var(--color-surface-2)" }}>
                  <Icon size={16} style={{ color: "var(--color-text-muted)" }} />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-sm" style={{ color: "var(--color-text)" }}>
                        {entry.title || (entry.entry_type === "education" ? "Student" : "Employee")}
                      </div>
                      <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>{entry.organization}</div>
                      {entry.location && <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>{entry.location}</div>}
                    </div>
                    <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {entry.start_date?.substring(0, 7)}{entry.is_current ? " – Present" : entry.end_date ? ` – ${entry.end_date.substring(0, 7)}` : ""}
                    </div>
                  </div>
                  {entry.description && <p className="text-sm mt-1.5" style={{ color: "var(--color-text-secondary)" }}>{entry.description}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manually verify**

Run: `pnpm tauri dev`. In Reader Mode, open Career — entries listed chronologically, no Add/Edit/Delete controls.

- [ ] **Step 4: Commit**

```bash
git add src/pages/reader/ReaderCareerPage.tsx
git commit -m "feat(reader): implement Career section"
```

---

## Task 9: Maps section — real content

**Files:**
- Modify: `src/pages/reader/ReaderMapsPage.tsx`

- [ ] **Step 1: Replace `src/pages/reader/ReaderMapsPage.tsx` with this content**

```tsx
import { useEffect, useState } from "react";
import MapView from "@/components/maps/MapView";
import { listMapPins } from "@/lib/actions/map-pins";
import type { MapPin } from "@/lib/models";

export default function ReaderMapsPage() {
  const [pins, setPins] = useState<MapPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPin, setSelectedPin] = useState<MapPin | null>(null);

  useEffect(() => {
    listMapPins().then(setPins).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 flex flex-col" style={{ height: "calc(100vh - 0px)" }}>
      <h1 className="text-2xl mb-6 flex-shrink-0" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
        Maps &amp; Places
      </h1>

      {loading ? (
        <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>
      ) : (
        <div className="flex gap-6 flex-1 min-h-0">
          <div className="flex-1 min-h-0 relative">
            <MapView pins={pins} onPinClick={setSelectedPin} height="100%" />
          </div>
          <div className="w-72 flex-shrink-0 flex flex-col gap-3 overflow-y-auto">
            {pins.map((pin) => (
              <div
                key={pin.id}
                className="p-3 rounded-xl border cursor-pointer"
                style={{
                  background: "var(--color-surface)",
                  borderColor: selectedPin?.id === pin.id ? "var(--color-primary)" : "var(--color-border)",
                  boxShadow: "var(--shadow-card)",
                }}
                onClick={() => setSelectedPin(pin)}
              >
                <div className="text-sm font-medium" style={{ color: "var(--color-text)" }}>{pin.name}</div>
                {pin.description && (
                  <div className="text-xs mt-0.5" style={{ color: "var(--color-text-secondary)" }}>{pin.description}</div>
                )}
                <div className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                  {pin.latitude.toFixed(4)}, {pin.longitude.toFixed(4)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manually verify**

Run: `pnpm tauri dev`. In Reader Mode, open Maps — map with pins renders, clicking a pin in the list highlights it, clicking on the map does nothing (no add-pin affordance, since `onMapClick` is intentionally not passed).

- [ ] **Step 4: Commit**

```bash
git add src/pages/reader/ReaderMapsPage.tsx
git commit -m "feat(reader): implement Maps section"
```

---

## Task 10: Full smoke test

- [ ] **Step 1: Run the full test suite**

Run: `pnpm test`
Expected: all tests pass (including the two `reader-utils` tests from Task 1 and the full existing sync suite).

- [ ] **Step 2: Full type-check**

Run: `npx tsc --noEmit`
Expected: no errors anywhere.

- [ ] **Step 3: Manual end-to-end walkthrough**

Run: `pnpm tauri dev`.
- From Overview, click "Read My Biography" → Cover page renders with title/tagline and background.
- Click through all 7 sidebar sections: Cover, Stories, Timeline, Gallery, Family Tree, Career, Maps — each shows real content (not "Coming soon").
- Open a published story → renders via `StoryEditor readOnly`, no toolbar.
- Open an album with photos → grid + lightbox work, video badge/playback works if you have a video.
- Confirm no unpublished (draft) stories appear anywhere in Stories.
- Click "← Exit Reader" from any section → returns to the normal editor Overview page with the regular app sidebar intact.
- Confirm the regular editor (Stories, Gallery, Timeline, etc. outside Reader Mode) still works exactly as before — no regressions from the `AlbumGrid` extraction or the root route change.

- [ ] **Step 4: If everything looks right, no further action needed** — Reader Mode (sub-project #2) is complete.

---

## Self-Review

**Spec coverage:**
- [x] Full-screen immersive mode, own sidebar, Exit link → Task 2
- [x] Persistent left sidebar nav across 7 sections → Task 2 (`ReaderSidebar`)
- [x] Editorial cover page with background image + gradient fallback + empty state → Task 2 (`ReaderCoverPage`)
- [x] Entry point on Overview page → Task 2
- [x] Published-only stories, reuses `StoryEditor readOnly` → Task 4
- [x] Timeline reuses existing display logic minus mutation UI → Task 5
- [x] Gallery/Album reuse extracted `AlbumGrid`, including video → Tasks 3, 6
- [x] Family Tree, Career, Maps sections → Tasks 7, 8, 9
- [x] No new DB tables/migrations → confirmed, no task touches `db.ts`
- [x] Vitest tests for published-only filter + empty-state check → Task 1
- [x] Manual smoke test across all sections → Task 10

**Placeholder scan:** No TBD/TODO; every step has complete, runnable code. Task 2's "Coming soon" placeholders are the intentional, temporary content of an incremental skeleton step — each is fully replaced by name in Tasks 4–9, not left as a loose end.

**Type consistency:** `Story`, `Milestone`, `Album`, `Media`, `FamilyMember`, `CareerEntry`, `MapPin`, `Biography` types are all used exactly as defined in `src/lib/models/index.ts` (verified against the current file, post sync-migration field removal). `AlbumGrid`'s `photos: Media[]` prop matches what `listMedia()` returns in both `AlbumPage` and `ReaderAlbumPage`. `isBiographyEmpty`/`filterPublishedStories` signatures in Task 1 match their call sites in Task 2 and Task 4.

**Known follow-ups (out of scope, noted in the spec):**
- No "show drafts" toggle in Reader Mode.
- No print/export affordance — that's sub-projects #3/#4.
- Static-site and PDF/book export are separate future cycles.
