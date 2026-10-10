import { createRouter, createRoute, createRootRoute, Outlet } from "@tanstack/react-router";
import AppShell from "@/components/layout/AppShell";

// Pages
import OverviewPage from "@/pages/OverviewPage";
import StoryListPage from "@/pages/stories/StoryListPage";
import StoryEditorPage from "@/pages/stories/StoryEditorPage";
import NewStoryPage from "@/pages/stories/NewStoryPage";
import TimelinePage from "@/pages/timeline/TimelinePage";
import MilestoneEditorPage, { NewMilestonePage } from "@/pages/timeline/MilestoneEditorPage";
import GalleryPage from "@/pages/gallery/GalleryPage";
import AlbumPage from "@/pages/gallery/AlbumPage";
import AlbumEditorPage, { NewAlbumPage } from "@/pages/gallery/AlbumEditorPage";
import FamilyTreePage from "@/pages/family-tree/FamilyTreePage";
import MemberEditorPage, { NewMemberPage } from "@/pages/family-tree/MemberEditorPage";
import CareerPage from "@/pages/career/CareerPage";
import CareerEditorPage, { NewCareerPage } from "@/pages/career/CareerEditorPage";
import MapsPage from "@/pages/maps/MapsPage";
import PinEditorPage, { NewPinPage } from "@/pages/maps/PinEditorPage";
import ImportHubPage from "@/pages/import/ImportHubPage";
import PhotoImportPage from "@/pages/import/PhotoImportPage";
import ArchiveImportPage from "@/pages/import/ArchiveImportPage";
import ReviewPage from "@/pages/import/ReviewPage";
import SettingsPage from "@/pages/settings/SettingsPage";
import ProfilePage from "@/pages/profile/ProfilePage";
import OrganizePage from "@/pages/organize/OrganizePage";

// Read-mode views (web-style presentation, shown when the sidebar toggle is on "Read")
import HomeView from "@/views/HomeView";
import StoriesView from "@/views/StoriesView";
import StoryView from "@/views/StoryView";
import TimelineView from "@/views/TimelineView";
import GalleryView from "@/views/GalleryView";
import AlbumView from "@/views/AlbumView";
import FamilyTreeView from "@/views/FamilyTreeView";
import CareerView from "@/views/CareerView";
import MapsView from "@/views/MapsView";
import { byMode } from "@/lib/view-mode";

// Root route — every page lives inside AppShell; each section's page switches
// between its editor and its read-only view via the sidebar Read/Edit toggle.
function RootComponent() {
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
  component: byMode(OverviewPage, HomeView),
});

// Stories
const storiesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/stories",
  component: byMode(StoryListPage, StoriesView),
});
const newStoryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/stories/new",
  component: NewStoryPage,
});
const storyEditorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/stories/$storyId",
  component: byMode(StoryEditorPage, StoryView),
});

// Timeline
const timelineRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/timeline",
  component: byMode(TimelinePage, TimelineView),
});

const newMilestoneRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/timeline/new",
  component: NewMilestonePage,
});
const milestoneEditorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/timeline/$milestoneId",
  component: MilestoneEditorPage,
});

// Gallery
const galleryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/gallery",
  component: byMode(GalleryPage, GalleryView),
});
const albumRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/gallery/albums/$albumId",
  component: byMode(AlbumPage, AlbumView),
});

const newAlbumRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/gallery/new",
  component: NewAlbumPage,
});
const albumEditorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/gallery/albums/$albumId/edit",
  component: AlbumEditorPage,
});

// Family Tree
const familyTreeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/family-tree",
  component: byMode(FamilyTreePage, FamilyTreeView),
});

const newMemberRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/family-tree/new",
  component: NewMemberPage,
});
const memberEditorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/family-tree/$memberId",
  component: MemberEditorPage,
  validateSearch: (search: Record<string, unknown>): { created?: string } => ({
    created: typeof search.created === "string" ? search.created : undefined,
  }),
});

// Career
const careerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/career",
  component: byMode(CareerPage, CareerView),
});

const newCareerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/career/new",
  component: NewCareerPage,
});
const careerEditorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/career/$entryId",
  component: CareerEditorPage,
});

// Maps
const mapsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/maps",
  component: byMode(MapsPage, MapsView),
});

const newPinRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/maps/new",
  component: NewPinPage,
  validateSearch: (search: Record<string, unknown>): { lat?: string; lng?: string; name?: string } => ({
    lat: typeof search.lat === "string" ? search.lat : undefined,
    lng: typeof search.lng === "string" ? search.lng : undefined,
    name: typeof search.name === "string" ? search.name : undefined,
  }),
});
const pinEditorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/maps/$pinId",
  component: PinEditorPage,
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

// Profile and categories/tags (edit tools; the same page in Read mode)
const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/profile",
  component: ProfilePage,
});
const organizeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/organize",
  component: OrganizePage,
});

// Settings
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
});

const routeTree = rootRoute.addChildren([
  overviewRoute,
  storiesRoute,
  newStoryRoute,
  storyEditorRoute,
  timelineRoute,
  newMilestoneRoute,
  milestoneEditorRoute,
  galleryRoute,
  newAlbumRoute,
  albumEditorRoute,
  albumRoute,
  familyTreeRoute,
  newMemberRoute,
  memberEditorRoute,
  careerRoute,
  newCareerRoute,
  careerEditorRoute,
  mapsRoute,
  newPinRoute,
  pinEditorRoute,
  importHubRoute,
  photoImportRoute,
  archiveImportRoute,
  reviewRoute,
  profileRoute,
  organizeRoute,
  settingsRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
