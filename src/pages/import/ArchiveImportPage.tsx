import { useState, useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import {
  ArrowLeft, Package, Loader2, CheckCircle, ChevronRight,
  Facebook, Instagram, Linkedin, HelpCircle,
} from "lucide-react";
import { detectPlatform, parseArchive, type Platform } from "@/lib/archive-parsers";
import { createImportJob, updateImportJob } from "@/lib/actions/import";

// ── Types ─────────────────────────────────────────────────────────────────

interface ExtractResult {
  extracted_path: string;
  file_count: number;
}

interface ExtractProgressEvent {
  total: number;
  extracted: number;
}

type Stage = "pick" | "extracting" | "parsing" | "done" | "error";

// ── Platform guide cards ──────────────────────────────────────────────────

const PLATFORM_GUIDES: Array<{
  id: Platform;
  name: string;
  Icon: React.ElementType;
  color: string;
  steps: string[];
  exportNote: string;
}> = [
  {
    id: "facebook",
    name: "Facebook",
    Icon: Facebook,
    color: "#1877F2",
    exportNote: "Settings → Your Facebook information → Download your information → Select JSON format",
    steps: [
      "Posts and activity will be imported as story drafts",
      "Covers up to 50 most recent posts",
      "Select JSON (not HTML) when exporting",
    ],
  },
  {
    id: "instagram",
    name: "Instagram",
    Icon: Instagram,
    color: "#E1306C",
    exportNote: "Settings → Your activity → Download your information → Select JSON format",
    steps: [
      "Captions from your posts become story drafts",
      "Covers up to 50 most recent posts",
      "Select JSON format when requesting data",
    ],
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    Icon: Linkedin,
    color: "#0A66C2",
    exportNote: "Settings → Data Privacy → Get a copy of your data → Select all data",
    steps: [
      "Work history imported as career entries",
      "Education imported as career entries",
      "Professional summary imported as a milestone",
    ],
  },
];

// ── Component ─────────────────────────────────────────────────────────────

export default function ArchiveImportPage() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("pick");
  const [archivePath, setArchivePath] = useState("");
  const [platform, setPlatform] = useState<Platform>("unknown");
  const [extractProgress, setExtractProgress] = useState(0);
  const [extractTotal, setExtractTotal] = useState(0);
  const [statusMsg, setStatusMsg] = useState("");
  const [importedCount, setImportedCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [expandedGuide, setExpandedGuide] = useState<Platform | null>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  useEffect(() => () => { unlistenRef.current?.(); }, []);

  async function pickAndImport() {
    const file = await open({
      multiple: false,
      filters: [{ name: "ZIP Archives", extensions: ["zip"] }],
    });
    if (!file || typeof file !== "string") return;
    setArchivePath(file);
    await runImport(file);
  }

  async function runImport(filePath: string) {
    setStage("extracting");
    setExtractProgress(0);
    setErrorMsg("");

    // Listen to extraction progress
    const unlisten = await listen<ExtractProgressEvent>("archive-extract-progress", (e) => {
      setExtractProgress(e.payload.extracted);
      setExtractTotal(e.payload.total);
    });
    unlistenRef.current = unlisten;

    let extractResult: ExtractResult;
    try {
      extractResult = await invoke<ExtractResult>("extract_archive", { archivePath: filePath });
    } catch (err) {
      unlisten();
      setErrorMsg(String(err));
      setStage("error");
      return;
    }
    unlisten();
    unlistenRef.current = null;

    setStage("parsing");
    setStatusMsg("Detecting platform…");

    const detectedPlatform = await detectPlatform(extractResult.extracted_path);
    setPlatform(detectedPlatform);
    setStatusMsg(`Detected: ${detectedPlatform === "unknown" ? "unknown — trying all parsers" : detectedPlatform}`);

    const job = await createImportJob(
      detectedPlatform === "facebook" ? "facebook"
      : detectedPlatform === "instagram" ? "instagram"
      : detectedPlatform === "linkedin" ? "linkedin"
      : "manual",
      filePath
    );

    let count = 0;
    try {
      count = await parseArchive(
        extractResult.extracted_path,
        detectedPlatform,
        job.id,
        (msg) => setStatusMsg(msg)
      );
      await updateImportJob(job.id, { status: "completed", processed_count: count, item_count: count });
    } catch (err) {
      await updateImportJob(job.id, { status: "failed", error: String(err) });
      setErrorMsg(String(err));
      setStage("error");
      return;
    }

    setImportedCount(count);
    setStage("done");
  }

  return (
    <div className="p-8 max-w-2xl">
      <button
        onClick={() => navigate({ to: "/import" })}
        className="flex items-center gap-1.5 text-sm mb-6"
        style={{ color: "var(--color-text-secondary)" }}
      >
        <ArrowLeft size={14} /> Import Hub
      </button>

      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "var(--color-primary)" + "18" }}>
          <Package size={18} style={{ color: "var(--color-primary)" }} />
        </div>
        <h1 className="text-2xl" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
          Import Social Media Archive
        </h1>
      </div>

      {/* ── Pick ── */}
      {stage === "pick" && (
        <div className="space-y-6">
          <div
            className="rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer hover:border-primary transition-colors"
            style={{ borderColor: "var(--color-border)" }}
            onClick={pickAndImport}
          >
            <Package size={36} className="mx-auto mb-3" style={{ color: "var(--color-text-muted)" }} />
            <div className="font-medium mb-1" style={{ color: "var(--color-text)" }}>Select your archive ZIP file</div>
            <div className="text-sm mb-4" style={{ color: "var(--color-text-muted)" }}>
              Facebook, Instagram, and LinkedIn exports are supported
            </div>
            <button
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm text-white font-medium mx-auto"
              style={{ background: "var(--color-primary)" }}
              onClick={(e) => { e.stopPropagation(); pickAndImport(); }}
            >
              Choose ZIP File
            </button>
          </div>

          {/* Platform guides */}
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: "var(--color-text-muted)" }}>
              How to export your data
            </div>
            {PLATFORM_GUIDES.map((guide) => {
              const Icon = guide.Icon;
              const expanded = expandedGuide === guide.id;
              return (
                <div
                  key={guide.id}
                  className="rounded-xl border overflow-hidden"
                  style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
                >
                  <button
                    className="w-full flex items-center gap-3 p-4 text-left"
                    onClick={() => setExpandedGuide(expanded ? null : guide.id)}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${guide.color}18` }}>
                      <Icon size={16} style={{ color: guide.color }} />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium" style={{ color: "var(--color-text)" }}>{guide.name}</div>
                      <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>{guide.exportNote}</div>
                    </div>
                    <ChevronRight
                      size={14}
                      style={{ color: "var(--color-text-muted)", transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}
                    />
                  </button>
                  {expanded && (
                    <div className="px-4 pb-4 pt-0">
                      <ul className="space-y-1">
                        {guide.steps.map((step, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                            <span className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[10px] font-bold"
                              style={{ background: guide.color }}
                            >{i + 1}</span>
                            {step}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}

            <div className="flex items-start gap-2 p-3 rounded-lg text-xs" style={{ background: "var(--color-surface-2)", color: "var(--color-text-muted)" }}>
              <HelpCircle size={14} className="flex-shrink-0 mt-0.5" />
              Archives may take 1-30 minutes to prepare on the platform's side before you can download them.
            </div>
          </div>
        </div>
      )}

      {/* ── Extracting ── */}
      {stage === "extracting" && (
        <div className="py-12">
          <div className="flex items-center gap-3 mb-4">
            <Loader2 size={18} className="animate-spin flex-shrink-0" style={{ color: "var(--color-primary)" }} />
            <div className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
              Extracting archive…
              {extractTotal > 0 && ` (${extractProgress} / ${extractTotal} files)`}
            </div>
          </div>
          {extractTotal > 0 && (
            <div className="w-full rounded-full h-2 overflow-hidden" style={{ background: "var(--color-surface-2)" }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ background: "var(--color-primary)", width: `${(extractProgress / extractTotal) * 100}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Parsing ── */}
      {stage === "parsing" && (
        <div className="flex flex-col items-center gap-4 py-12">
          <Loader2 size={28} className="animate-spin" style={{ color: "var(--color-primary)" }} />
          <div className="text-sm text-center" style={{ color: "var(--color-text-secondary)" }}>{statusMsg}</div>
        </div>
      )}

      {/* ── Done ── */}
      {stage === "done" && (
        <div className="flex flex-col items-center gap-6 py-12">
          <CheckCircle size={48} style={{ color: "var(--color-primary)" }} />
          <div>
            <div className="text-lg font-semibold text-center" style={{ color: "var(--color-text)" }}>
              Import complete!
            </div>
            <div className="text-sm text-center mt-1" style={{ color: "var(--color-text-secondary)" }}>
              {importedCount > 0
                ? `${importedCount} item${importedCount !== 1 ? "s" : ""} added for review`
                  + (platform !== "unknown" ? ` from your ${platform.charAt(0).toUpperCase() + platform.slice(1)} archive` : "")
                : "No importable content was found in this archive."}
            </div>
          </div>
          <div className="flex gap-3">
            {importedCount > 0 && (
              <button
                onClick={() => navigate({ to: "/import/review" })}
                className="px-5 py-2 rounded-lg text-sm text-white font-medium"
                style={{ background: "var(--color-primary)" }}
              >
                Review Suggestions →
              </button>
            )}
            <button
              onClick={() => { setStage("pick"); setArchivePath(""); setImportedCount(0); }}
              className="px-5 py-2 rounded-lg text-sm border"
              style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}
            >
              Import Another
            </button>
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {stage === "error" && (
        <div className="py-12">
          <div
            className="p-5 rounded-xl border"
            style={{ background: "var(--color-surface)", borderColor: "var(--color-error)" + "40" }}
          >
            <div className="font-medium text-sm mb-2" style={{ color: "var(--color-error)" }}>Import failed</div>
            <div className="text-sm font-mono break-all" style={{ color: "var(--color-text-secondary)" }}>{errorMsg}</div>
          </div>
          <button
            onClick={() => setStage("pick")}
            className="mt-4 px-4 py-2 rounded-lg text-sm border"
            style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
