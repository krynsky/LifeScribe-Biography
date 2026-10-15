# LifeScribe User Guide

LifeScribe is a desktop app for writing and organizing your life story. Everything lives on your own computer — your stories, photos, timeline, family tree, career history, and places all stay in a local database, and the app works fully offline.

## Getting Started

1. Install and launch LifeScribe. A new, empty biography titled "My Life Story" is created automatically.
2. Use the sidebar on the left to move between sections.
3. Start anywhere — write a story, add a milestone, or import your photos. There's no required order.

Your data is stored locally on your machine. Nothing is uploaded anywhere; the app has no online account.

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


### Review Screen
Nothing imported is added to your biography automatically. Every suggestion lands in the **Review** screen first, where you can accept, edit, or reject each item — individually or in bulk. Only accepted items become part of your biography.

## Read and Edit modes

The **Read | Edit** toggle at the top of the sidebar switches the whole app between editing and reading. In Read mode every section (Overview, Stories, Timeline, Gallery, Family Tree, Career, Maps) shows your biography as a finished, read-only site, using the same sidebar. Switch back to Edit at any time and you land on the same section. You can also click **Read My Biography** on the Overview to switch to Read mode. Use it to proofread, to show your story to family, or just to enjoy what you've built.

## Settings

- **Data location**: see where your data is stored and move it to another folder.
- **Back up your data**: save a snapshot of your database.
- **Photo library**: copy photos imported earlier into the app so they keep working if the originals move.

The app never requires an account and doesn't connect to any website. It is a complete, private, offline biography tool.

## Where Your Data Lives

- **Database**: a single SQLite file (`lifescribe.db`). By default it is in the app's data folder; see **Settings → Data location** to move everything to a folder of your choice.
- **Photos**: stay exactly where they are on your disk — the app stores their locations, not copies.
- **Thumbnails**: generated copies cached in the app's data folder.

### Choosing your data folder

**Settings → Data location** shows where your data is and lets you pick a different folder, for example on another drive. The app copies your database, images, imported photos and backups there, updates the saved file locations, and switches to the new folder when you restart. Your previous data is left where it was as a safety copy; delete it yourself once you're happy. Avoid cloud-synced folders (OneDrive, Dropbox, Google Drive): syncing a database while the app is using it can corrupt it. If the folder is on a drive that isn't connected when the app starts, the app tells you and asks you to reconnect it.

Backing up is simple: use **Settings → Back up now** to save a snapshot of the database (the newest 10 are kept), and keep a copy of the app's data folder, including its `images` folder.

## Tips

- Set event dates on stories even if you only know the year — they'll slot into the right place chronologically.
- Re-running a photo import is safe; duplicates are skipped.
- Use draft status freely — only published stories appear in Read mode.
- Review imported suggestions in small batches; bulk accept/reject is available when you're confident.
