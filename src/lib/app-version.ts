import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";

/** The app's version (from tauri.conf.json), or "" until it has loaded. */
export function useAppVersion(): string {
  const [version, setVersion] = useState("");
  useEffect(() => {
    getVersion().then(setVersion).catch(() => {});
  }, []);
  return version;
}
