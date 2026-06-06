import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";
import { ArrowLeft, Camera, FolderOpen, Loader2, CheckCircle, Circle, AlertCircle, Plus } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { insertMedia, createAlbum, listAlbums, checkMediaExists } from "@/lib/actions/gallery";
import type { Album } from "@/lib/models";

// ── Rust types ─────────────────────────────────────────────────────────────

interface ScannedPhoto {
  path: string;
  filename: string;
  file_size: number;
  modified_at: string | null;
}

interface ExifData {
  taken_at: string | null;
  camera_make: string | null;
  camera_model: string | null;
  latitude: number | null;
  longitude: number | null;
  width: number | null;
  height: number | null;
}

interface BatchProgressEvent {
  path: string;
  thumbnail_path: string | null;
  hash: string | null;
  exif: ExifData | null;
  index: number;
  total: number;
  error: string | null;
}

// ── Local state shape ───────────────────────────────────────────────────────

type Stage = "pick" | "scan" | "process" | "review" | "importing" | "done";

interface PhotoEntry {
  scanned: ScannedPhoto;
  thumbnail: string | null;
  hash: string | null;
  exif: ExifData | null;
  error: string | null;
  selected: boolean;
  duplicate: boolean;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

function suggestAlbumName(photos: PhotoEntry[]): string {
  const dates = photos
    .filter((p) => p.exif?.taken_at)
    .map((p) => p.exif!.taken_at!.substring(0, 7))
    .sort();
  if (dates.length === 0) return "Imported Photos";
  const first = dates[0];
  const last = dates[dates.length - 1];
  if (first === last) return `Photos – ${first}`;
  return `Photos – ${first} to ${last}`;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function PhotoImportPage() {
  const navigate = useNavigate();

  const [stage, setStage] = useState<Stage>("pick");
  const [folderPath, setFolderPath] = useState<string>("");
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [processed, setProcessed] = useState(0);
  const [total, setTotal] = useState(0);

  // album assignment
  const [albums, setAlbums] = useState<Album[]>([]);
  const [albumModalOpen, setAlbumModalOpen] = useState(false);
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null>(null);
  const [newAlbumName, setNewAlbumName] = useState("");
  const [creatingAlbum, setCreatingAlbum] = useState(false);

  const [importedCount, setImportedCount] = useState(0);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  // Cleanup listener on unmount
  useEffect(() => {
    return () => { unlistenRef.current?.(); };
  }, []);

  // ── Step 1: Pick folder ──────────────────────────────────────────────────

  async function pickFolder() {
    const folder = await open({ directory: true, multiple: false });
    if (!folder || typeof folder !== "string") return;
    setFolderPath(folder);
    await scanFolder(folder);
  }

  // ── Step 2: Scan ─────────────────────────────────────────────────────────

  async function scanFolder(folder: string) {
    setStage("scan");
    try {
      const scanned = await invoke<ScannedPhoto[]>("scan_folder", { folderPath: folder });
      if (scanned.length === 0) {
        setStage("pick");
        return;
      }
      // Build initial entries
      const entries: PhotoEntry[] = scanned.map((s) => ({
        scanned: s,
        thumbnail: null,
        hash: null,
        exif: null,
        error: null,
        selected: true,
        duplicate: false,
      }));
      setPhotos(entries);
      setTotal(scanned.length);
      setProcessed(0);
      await processPhotos(scanned, entries);
    } catch (err) {
      console.error("scan_folder failed:", err);
      setStage("pick");
    }
  }

  // ── Step 3: Batch process (thumbnails + EXIF) ────────────────────────────

  const processPhotos = useCallback(
    async (scanned: ScannedPhoto[], initial: PhotoEntry[]) => {
      setStage("process");

      // Listen to per-photo progress events
      const unlisten = await listen<BatchProgressEvent>("photo-batch-progress", (event) => {
        const ev = event.payload;
        setProcessed(ev.index + 1);
        setPhotos((prev) =>
          prev.map((p) =>
            p.scanned.path === ev.path
              ? { ...p, thumbnail: ev.thumbnail_path, hash: ev.hash, exif: ev.exif, error: ev.error }
              : p
          )
        );
      });
      unlistenRef.current = unlisten;

      try {
        await invoke("batch_process_photos", {
          paths: scanned.map((s) => s.path),
          thumbSize: 320,
        });
      } catch (err) {
        console.error("batch_process_photos failed:", err);
      } finally {
        unlisten();
        unlistenRef.current = null;
      }

      // Mark duplicates
      const seen = new Set<string>();
      setPhotos((prev) =>
        prev.map((p) => {
          if (!p.hash) return p;
          const dup = seen.has(p.hash);
          if (!dup) seen.add(p.hash);
          return { ...p, duplicate: dup, selected: !dup };
        })
      );

      // Check DB for existing hashes
      setPhotos((prev) => {
        // We'll do async check in a separate effect; for now just move to review
        return prev;
      });

      // Load albums
      const existingAlbums = await listAlbums();
      setAlbums(existingAlbums);

      setStage("review");
    },
    []
  );

  // ── Selection helpers ────────────────────────────────────────────────────

  function toggleAll(sel: boolean) {
    setPhotos((prev) => prev.map((p) => ({ ...p, selected: p.duplicate ? false : sel })));
  }

  function togglePhoto(path: string) {
    setPhotos((prev) =>
      prev.map((p) => (p.scanned.path === path ? { ...p, selected: !p.selected } : p))
    );
  }

  // ── Step 4: Import ───────────────────────────────────────────────────────

  async function handleImport() {
    const toImport = photos.filter((p) => p.selected && !p.duplicate);
    if (toImport.length === 0) return;

    // Check for DB duplicates by hash
    const dedupedList: PhotoEntry[] = [];
    for (const p of toImport) {
      if (p.hash) {
        const exists = await checkMediaExists(p.hash);
        if (exists) continue;
      }
      dedupedList.push(p);
    }

    // Ensure album
    let albumId: number | undefined = selectedAlbumId ?? undefined;
    if (creatingAlbum && newAlbumName.trim()) {
      const album = await createAlbum({ name: newAlbumName.trim(), date_from: undefined });
      albumId = album.id;
    }

    setStage("importing");
    let count = 0;
    for (const p of dedupedList) {
      const filename = p.scanned.filename;
      const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
      const mimeMap: Record<string, string> = {
        jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
        webp: "image/webp", gif: "image/gif", bmp: "image/bmp",
        tiff: "image/tiff", tif: "image/tiff", heic: "image/heic",
      };
      await insertMedia({
        file_path: p.scanned.path,
        thumbnail_path: p.thumbnail ?? undefined,
        filename,
        width: p.exif?.width ?? undefined,
        height: p.exif?.height ?? undefined,
        file_size: p.scanned.file_size,
        mime_type: mimeMap[ext] ?? "image/jpeg",
        taken_at: p.exif?.taken_at ?? undefined,
        camera_make: p.exif?.camera_make ?? undefined,
        camera_model: p.exif?.camera_model ?? undefined,
        latitude: p.exif?.latitude ?? undefined,
        longitude: p.exif?.longitude ?? undefined,
        album_id: albumId,
        import_hash: p.hash ?? undefined,
      });
      count++;
      setImportedCount(count);
    }

    setStage("done");
  }

  // ── Album modal ──────────────────────────────────────────────────────────

  async function openAlbumModal() {
    const latest = await listAlbums();
    setAlbums(latest);
    setNewAlbumName(suggestAlbumName(photos));
    setAlbumModalOpen(true);
  }

  const selectedCount = photos.filter((p) => p.selected && !p.duplicate).length;
  const dupCount = photos.filter((p) => p.duplicate).length;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-8 max-w-5xl">
      <button
        onClick={() => navigate({ to: "/import" })}
        className="flex items-center gap-1.5 text-sm mb-6"
        style={{ color: "var(--color-text-secondary)" }}
      >
        <ArrowLeft size={14} /> Import Hub
      </button>

      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "var(--color-accent)" + "20" }}>
          <Camera size={18} style={{ color: "var(--color-accent-dark)" }} />
        </div>
        <div>
          <h1 className="text-2xl" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>Import Photos</h1>
          {folderPath && <div className="text-xs mt-0.5 truncate max-w-lg" style={{ color: "var(--color-text-muted)" }}>{folderPath}</div>}
        </div>
      </div>

      {/* ── Pick ── */}
      {stage === "pick" && (
        <div
          className="rounded-2xl border-2 border-dashed p-16 text-center cursor-pointer transition-colors hover:border-primary"
          style={{ borderColor: "var(--color-border)" }}
          onClick={pickFolder}
        >
          <FolderOpen size={40} className="mx-auto mb-4" style={{ color: "var(--color-text-muted)" }} />
          <div className="font-medium mb-1" style={{ color: "var(--color-text)" }}>Choose a folder to import</div>
          <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>All JPG, PNG, WEBP, HEIC, and RAW files will be scanned</div>
          <button
            className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm text-white font-medium mx-auto"
            style={{ background: "var(--color-primary)" }}
            onClick={(e) => { e.stopPropagation(); pickFolder(); }}
          >
            <FolderOpen size={14} /> Select Folder
          </button>
        </div>
      )}

      {/* ── Scan ── */}
      {stage === "scan" && (
        <div className="flex flex-col items-center gap-4 py-20">
          <Loader2 size={32} className="animate-spin" style={{ color: "var(--color-primary)" }} />
          <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Scanning folder for photos…</div>
        </div>
      )}

      {/* ── Process ── */}
      {stage === "process" && (
        <div className="py-16">
          <div className="max-w-md mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <Loader2 size={18} className="animate-spin flex-shrink-0" style={{ color: "var(--color-primary)" }} />
              <div className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                Processing {processed} / {total} photos…
              </div>
            </div>
            <div className="w-full rounded-full h-2 overflow-hidden" style={{ background: "var(--color-surface-2)" }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ background: "var(--color-primary)", width: total ? `${(processed / total) * 100}%` : "0%" }}
              />
            </div>
            <div className="text-xs mt-2 text-right" style={{ color: "var(--color-text-muted)" }}>
              {total ? Math.round((processed / total) * 100) : 0}%
            </div>

            {/* Live thumbnails preview (last 6 processed) */}
            <div className="grid grid-cols-6 gap-1.5 mt-6">
              {photos
                .filter((p) => p.thumbnail)
                .slice(-6)
                .map((p) => (
                  <div key={p.scanned.path} className="aspect-square rounded overflow-hidden" style={{ background: "var(--color-surface-2)" }}>
                    <img src={convertFileSrc(p.thumbnail!)} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Review ── */}
      {stage === "review" && (
        <div>
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                {selectedCount} of {photos.length - dupCount} selected
              </span>
              {dupCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--color-surface-2)", color: "var(--color-text-muted)" }}>
                  {dupCount} duplicate{dupCount !== 1 ? "s" : ""} skipped
                </span>
              )}
              <button className="text-xs" style={{ color: "var(--color-primary)" }} onClick={() => toggleAll(true)}>Select all</button>
              <button className="text-xs" style={{ color: "var(--color-text-muted)" }} onClick={() => toggleAll(false)}>Deselect all</button>
            </div>

            {/* Album picker */}
            <div className="flex items-center gap-2">
              <button
                onClick={openAlbumModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm"
                style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}
              >
                <Plus size={12} />
                {selectedAlbumId
                  ? albums.find((a) => a.id === selectedAlbumId)?.name ?? "Album"
                  : creatingAlbum && newAlbumName
                  ? `New: ${newAlbumName}`
                  : "Add to album"}
              </button>

              <button
                disabled={selectedCount === 0}
                onClick={handleImport}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white font-medium disabled:opacity-50"
                style={{ background: "var(--color-primary)" }}
              >
                Import {selectedCount} Photo{selectedCount !== 1 ? "s" : ""}
              </button>
            </div>
          </div>

          {/* Photo grid */}
          <div className="grid grid-cols-5 gap-2">
            {photos.map((p) => (
              <button
                key={p.scanned.path}
                onClick={() => !p.duplicate && togglePhoto(p.scanned.path)}
                disabled={p.duplicate}
                className="relative aspect-square rounded-lg overflow-hidden group"
                style={{
                  background: "var(--color-surface-2)",
                  border: `2px solid ${p.duplicate ? "var(--color-border)" : p.selected ? "var(--color-primary)" : "var(--color-border)"}`,
                  opacity: p.duplicate ? 0.4 : 1,
                }}
              >
                {p.thumbnail ? (
                  <img src={convertFileSrc(p.thumbnail)} alt={p.scanned.filename} className="w-full h-full object-cover" />
                ) : p.error ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <AlertCircle size={16} style={{ color: "var(--color-error)" }} />
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Camera size={16} style={{ color: "var(--color-text-muted)" }} />
                  </div>
                )}

                {/* Selection check */}
                <div className="absolute top-1 left-1">
                  {p.duplicate ? (
                    <span className="text-xs px-1 py-0.5 rounded" style={{ background: "rgba(0,0,0,0.6)", color: "white" }}>dup</span>
                  ) : p.selected ? (
                    <CheckCircle size={16} style={{ color: "var(--color-primary)" }} className="drop-shadow" />
                  ) : (
                    <Circle size={16} style={{ color: "rgba(255,255,255,0.7)" }} className="drop-shadow" />
                  )}
                </div>

                {/* Date overlay */}
                {p.exif?.taken_at && (
                  <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 text-[10px] truncate"
                    style={{ background: "rgba(0,0,0,0.5)", color: "white" }}
                  >
                    {p.exif.taken_at.substring(0, 10)}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Importing ── */}
      {stage === "importing" && (
        <div className="flex flex-col items-center gap-4 py-20">
          <Loader2 size={32} className="animate-spin" style={{ color: "var(--color-primary)" }} />
          <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            Importing {importedCount} / {selectedCount} photos…
          </div>
        </div>
      )}

      {/* ── Done ── */}
      {stage === "done" && (
        <div className="flex flex-col items-center gap-6 py-20">
          <CheckCircle size={48} style={{ color: "var(--color-primary)" }} />
          <div>
            <div className="text-lg font-semibold text-center" style={{ color: "var(--color-text)" }}>
              {importedCount} photo{importedCount !== 1 ? "s" : ""} imported!
            </div>
            <div className="text-sm text-center mt-1" style={{ color: "var(--color-text-muted)" }}>
              {selectedAlbumId
                ? `Added to "${albums.find((a) => a.id === selectedAlbumId)?.name}"`
                : creatingAlbum && newAlbumName
                ? `Added to new album "${newAlbumName}"`
                : "Added to your gallery"}
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate({ to: "/gallery" })}
              className="px-5 py-2 rounded-lg text-sm text-white font-medium"
              style={{ background: "var(--color-primary)" }}
            >
              View Gallery
            </button>
            <button
              onClick={() => { setStage("pick"); setPhotos([]); setFolderPath(""); setImportedCount(0); setSelectedAlbumId(null); setCreatingAlbum(false); }}
              className="px-5 py-2 rounded-lg text-sm border"
              style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}
            >
              Import More
            </button>
          </div>
        </div>
      )}

      {/* ── Album modal ── */}
      <Modal open={albumModalOpen} onClose={() => setAlbumModalOpen(false)} title="Add to Album">
        <div className="space-y-3">
          {/* Existing albums */}
          {albums.length > 0 && (
            <div>
              <div className="text-xs font-medium mb-2" style={{ color: "var(--color-text-muted)" }}>Existing albums</div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {albums.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => { setSelectedAlbumId(a.id); setCreatingAlbum(false); setAlbumModalOpen(false); }}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm"
                    style={{
                      background: selectedAlbumId === a.id ? "var(--color-primary)" + "18" : "var(--color-surface-2)",
                      color: selectedAlbumId === a.id ? "var(--color-primary)" : "var(--color-text)",
                    }}
                  >
                    {a.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="border-t pt-3" style={{ borderColor: "var(--color-border)" }}>
            <div className="text-xs font-medium mb-2" style={{ color: "var(--color-text-muted)" }}>Create new album</div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newAlbumName}
                onChange={(e) => setNewAlbumName(e.target.value)}
                placeholder="Album name"
                className="flex-1 px-3 py-2 rounded-lg border text-sm"
                style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
              />
              <button
                onClick={() => { setCreatingAlbum(true); setSelectedAlbumId(null); setAlbumModalOpen(false); }}
                disabled={!newAlbumName.trim()}
                className="px-4 py-2 rounded-lg text-sm text-white disabled:opacity-50"
                style={{ background: "var(--color-primary)" }}
              >
                Use
              </button>
            </div>
          </div>

          <button
            onClick={() => { setSelectedAlbumId(null); setCreatingAlbum(false); setAlbumModalOpen(false); }}
            className="w-full py-2 rounded-lg text-sm border"
            style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
          >
            No album (add to gallery)
          </button>
        </div>
      </Modal>
    </div>
  );
}
