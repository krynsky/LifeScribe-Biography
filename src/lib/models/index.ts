// TypeScript models matching the SQLite schema

export interface Biography {
  id: number;
  title: string;
  bio: string | null;
  birth_date: string | null;
  birth_place: string | null;
  cover_photo_path: string | null;
  subject_first_name?: string | null;
  subject_middle_name?: string | null;
  subject_last_name?: string | null;
  subject_maiden_name?: string | null;
  subject_suffix?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Story {
  id: number;
  title: string;
  slug: string | null;
  content: string | null; // Tiptap JSON string
  excerpt: string | null;
  status: "draft" | "published";
  event_date: string | null;
  event_date_precision: "year" | "month" | "day";
  featured_image_path: string | null;
  // Display fields joined in from the shared categories/tags tables
  category?: string | null;
  category_color?: string | null;
  category_icon?: string | null;
  category_id?: number | null;
  tags?: string | null; // JSON array of tag names
  view_count: number;
  created_at: string;
  updated_at: string;
}

export interface Milestone {
  id: number;
  title: string;
  description: string | null;
  date: string;
  date_precision: "year" | "month" | "day";
  category: string | null;
  color: string;
  image_path: string | null;
  // Display fields joined in from the shared categories/tags tables
  category_color?: string | null;
  category_icon?: string | null;
  category_id?: number | null;
  end_date?: string | null;
  end_date_precision?: string | null;
  position?: number | null;
  created_at: string;
  updated_at: string;
}

export interface Album {
  id: number;
  name: string;
  description: string | null;
  cover_media_id: number | null;
  date_from: string | null;
  date_to: string | null;
  // Display fields joined in from the shared categories/tags tables
  category?: string | null;
  category_color?: string | null;
  category_icon?: string | null;
  category_id?: number | null;
  tags?: string | null; // JSON array of tag names
  position?: number | null;
  created_at: string;
  updated_at: string;
  // Joined count
  media_count?: number;
}

export interface Media {
  id: number;
  file_path: string;
  thumbnail_path: string | null;
  filename: string;
  title: string | null;
  caption: string | null;
  width: number | null;
  height: number | null;
  file_size: number | null;
  mime_type: string;
  taken_at: string | null;
  camera_make: string | null;
  camera_model: string | null;
  latitude: number | null;
  longitude: number | null;
  album_id: number | null;
  sort_order: number;
  is_favorite: boolean;
  import_source: string | null;
  import_hash: string | null;
  source_url: string | null; // video media: external embed URL (e.g. YouTube)
  created_at: string;
  updated_at: string;
}

export interface FamilyMember {
  id: number;
  given_name: string;
  surname: string | null;
  birth_date: string | null;
  death_date: string | null;
  birth_place: string | null;
  bio: string | null;
  photo_path: string | null;
  gender?: string | null; // "male" | "female" | "other"
  birth_surname?: string | null;
  nickname?: string | null;
  suffix?: string | null;
  position?: number | null;
  created_at: string;
  updated_at: string;
}

export interface FamilyRelationship {
  id: number;
  from_member_id: number;
  to_member_id: number;
  relationship_type: "parent" | "child" | "sibling" | "spouse" | "partner" | "other";
  /** 1 when a spouse relationship has ended (divorced). */
  ended?: number;
}

export interface CareerEntry {
  id: number;
  entry_type: "job" | "education";
  organization: string;
  title: string | null;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  location: string | null;
  logo_path: string | null;
  employment_type?: string | null;
  // Display fields joined in from the shared categories/tags tables
  category?: string | null;
  category_color?: string | null;
  category_icon?: string | null;
  category_id?: number | null;
  created_at: string;
  updated_at: string;
}

export interface MapPin {
  id: number;
  name: string;
  description: string | null;
  latitude: number;
  longitude: number;
  address: string | null;
  visit_date: string | null;
  pin_type: "place" | "home" | "work" | "travel" | "memory";
  color: string;
  image_path?: string | null;
  position?: number | null;
  // Display fields joined in from the shared categories/tags tables
  category?: string | null;
  category_color?: string | null;
  category_icon?: string | null;
  category_id?: number | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  color: string;
  created_at: string;
}

export interface Tag {
  id: number;
  name: string;
  slug: string;
  created_at: string;
}

export interface ImportJob {
  id: number;
  source_platform: "photos" | "facebook" | "instagram" | "linkedin" | "google_takeout" | "manual";
  status: "running" | "completed" | "failed" | "cancelled";
  archive_path: string | null;
  item_count: number;
  processed_count: number;
  failed_count: number;
  started_at: string;
  completed_at: string | null;
  error: string | null;
}

export type ImportItemType = "story" | "milestone" | "media" | "career" | "map_pin" | "album";
export type ImportItemStatus = "pending_curation" | "pending_review" | "accepted" | "rejected" | "skipped";

export interface ImportItem {
  id: number;
  import_job_id: number | null;
  item_type: ImportItemType;
  status: ImportItemStatus;
  content: string; // JSON string of suggested content
  source_data: string | null;
  ai_confidence: number | null;
  created_at: string;
  updated_at: string;
}

// Parsed content types for import items
export interface ImportStoryContent {
  title: string;
  content: string; // Tiptap JSON
  excerpt?: string;
  event_date?: string;
  event_date_precision?: "year" | "month" | "day";
  media_ids?: number[];
}

export interface ImportMilestoneContent {
  title: string;
  description?: string;
  date: string;
  date_precision?: "year" | "month" | "day";
  category?: string;
  image_path?: string;
}

export interface ImportMediaContent {
  file_path: string;
  title?: string;
  caption?: string;
  taken_at?: string;
  latitude?: number;
  longitude?: number;
  album_name?: string;
}

export interface ImportCareerContent {
  entry_type: "job" | "education";
  organization: string;
  title?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  is_current?: boolean;
  location?: string;
}

export interface ImportMapPinContent {
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  address?: string;
  visit_date?: string;
}
