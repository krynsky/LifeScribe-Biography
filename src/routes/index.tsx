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
