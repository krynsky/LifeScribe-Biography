# LifeScribe User Guide

LifeScribe is a desktop app for writing and organizing your life story. Everything lives on your own computer — your stories, photos, timeline, family tree, career history, and places all stay in a local database, and the app works fully offline. If you have a lifescribe.us account, you can optionally sync your biography to the web when you're ready to share it.

## Getting Started

1. Install and launch LifeScribe. A new, empty biography titled "My Life Story" is created automatically.
2. Use the sidebar on the left to move between sections.
3. Start anywhere — write a story, add a milestone, or import your photos. There's no required order.

Your data is stored locally on your machine. Nothing is uploaded anywhere unless you connect a lifescribe.us account in Settings and choose to publish.

## Sections of Your Biography

### Overview
Your home base. Shows your biography at a glance — title, tagline, cover photo, and a summary of your content.

### Stories
Long-form writing about moments and chapters of your life. The story editor is a full rich-text editor with:

- Headings, bold/italic/underline, lists, quotes, tables, and task lists
- Photos and images embedded directly in the text
- YouTube and Vimeo video embeds, and Google Maps embeds
- Links, highlights, text color, and alignment

Each story can have an event date (as precise as a day or as loose as just a year), a featured image, categories, and tags. Stories start as drafts; publish them when they're ready to appear in Read mode and on the web.

### Timeline
Milestones — the key dates of your life (births, graduations, moves, weddings). Each milestone has a title, date, optional description, category, color, and image. The timeline displays them in chronological order.

### Gallery
Your photo collection, organized into albums. Photos are referenced from wherever they already live on your disk — LifeScribe does not copy or move your files. Thumbnails are generated automatically for fast browsing. You can add captions and titles, mark favorites, and set album cover photos.

### Family Tree
People in your family and how they relate to each other — parents, children, siblings, spouses, and partners. Each person can have a photo, birth/death dates, birthplace, and a short bio.

### Career
Your work and education history. Jobs and schools each get an organization, title, dates, location, description, and optional logo.

### Maps
Places that matter — homes, workplaces, travel destinations, and memory spots — pinned on an interactive map. Pins can have descriptions, visit dates, and colors, and photos can be linked to places.

## Importing Your Content

The **Import** section is the fastest way to fill your biography. There are two paths:

### Photo Import
Point LifeScribe at a folder of photos. The app scans the folder, reads each photo's embedded metadata (date taken, GPS location, camera), generates thumbnails, and adds everything to your gallery. Duplicate photos are detected and skipped automatically, so you can safely re-run an import.

### Social Media Archive Import
Bring in your history from platforms you've used for years:

- **Facebook** — posts and life events
- **Instagram** — posts
- **LinkedIn** — work positions and education

How it works:

1. Request a copy of your data from the platform (each service has a "Download your information" / data export feature).
2. In LifeScribe, go to **Import → Archive Import** and select the downloaded ZIP file.
3. LifeScribe extracts the archive, detects which platform it came from, and parses its contents into suggested biography entries — posts become stories, life events become milestones, work history becomes career entries.

### AI Curation (optional)
If you add a Claude API key in Settings, LifeScribe can use AI to organize raw imported text into structured suggestions — pulling out story ideas, milestones, career entries, and places from your posts and notes. The AI only extracts what's clearly supported by your content; it never invents details.

### Review Screen
Nothing imported is added to your biography automatically. Every suggestion lands in the **Review** screen first, where you can accept, edit, or reject each item — individually or in bulk. Only accepted items become part of your biography.

## Read and Edit modes

The **Read | Edit** toggle at the top of the sidebar switches the whole app between editing and reading. In Read mode every section (Overview, Stories, Timeline, Gallery, Family Tree, Career, Maps) shows the same presentation visitors see on lifescribe.us, using the same sidebar. Switch back to Edit at any time and you land on the same section. You can also click **Read My Biography** on the Overview to switch to Read mode. Use it to proofread, to show your story to family, or just to enjoy what you've built.

## Settings

### Claude API Key
To enable AI curation, paste your Anthropic API key here. The key is stored locally on your machine and used only to make AI requests on your behalf. You can get a key from [console.anthropic.com](https://console.anthropic.com).

### Sync with lifescribe.us (optional)
Connect your lifescribe.us account with a sync token to link your desktop biography with the web:

- **Refresh** — pull the latest content from the web into the app.
- **Publish** — push local items that haven't been published yet up to the web.
- **Reset** — replace local synced content with a fresh copy from the web.

Sync has modes that control which side is the source of truth (web-master, app-master, or standalone/offline). If the same item changed in both places, conflicts are listed so you can resolve them deliberately — nothing is silently overwritten.

The app never requires an account. In standalone mode it is a complete, private, offline biography tool.

## Where Your Data Lives

- **Database**: a single SQLite file (`lifescribe.db`) in the app's local data folder.
- **Photos**: stay exactly where they are on your disk — the app stores their locations, not copies.
- **Thumbnails**: generated copies cached in the app's data folder.
- **API key and sync credentials**: stored locally in the app.

Backing up is simple: keep a copy of the app's data folder and your photo folders.

## Tips

- Set event dates on stories even if you only know the year — they'll slot into the right place chronologically.
- Re-running a photo import is safe; duplicates are skipped.
- Use draft status freely — only published stories appear in Read mode.
- Review imported suggestions in small batches; bulk accept/reject is available when you're confident.
