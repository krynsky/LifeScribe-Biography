import { createRouter, createRoute, createRootRoute, Outlet } from "@tanstack/react-router";
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

// Root route — wraps everything in AppShell
const rootRoute = createRootRoute({
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
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
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
