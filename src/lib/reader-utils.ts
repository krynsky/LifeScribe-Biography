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
