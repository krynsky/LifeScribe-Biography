// src/components/editor/extensions/google-maps-embed.ts
import { Node } from "@tiptap/core";

/**
 * The web stores Maps embeds as `maps/embed/v1/place?key=…&q=…`. That key is restricted to
 * the website's HTTP referrer, so inside the desktop webview (origin tauri.localhost) Google
 * refuses to render it. The keyless `maps.google.com/maps?q=…&output=embed` form shows the
 * same place without a key, so rewrite to it for display (the stored content is untouched).
 */
export function keylessMapsSrc(src: string | null | undefined): string | null {
  if (!src) return null;
  try {
    const url = new URL(src);
    if (url.hostname.endsWith("google.com") && url.pathname.startsWith("/maps/embed/v1/")) {
      const q = url.searchParams.get("q") ?? url.searchParams.get("center");
      if (q) return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
    }
  } catch {
    /* not a URL — leave as is */
  }
  return src;
}

export interface GoogleMapsEmbedOptions {
  HTMLAttributes: Record<string, string>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    googleMapsEmbed: {
      setGoogleMapsEmbed: (options: { src: string }) => ReturnType;
    };
  }
}

export const GoogleMapsEmbed = Node.create<GoogleMapsEmbedOptions>({
  name: "googleMapsEmbed",
  group: "block",
  atom: true,
  draggable: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      src: { default: null },
      width: { default: "100%" },
      height: { default: 450 },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-google-maps-embed]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      { "data-google-maps-embed": "", style: "margin:1rem 0;" },
      [
        "iframe",
        {
          src: keylessMapsSrc(HTMLAttributes.src) ?? HTMLAttributes.src,
          width: HTMLAttributes.width,
          height: HTMLAttributes.height,
          frameborder: "0",
          allowfullscreen: "true",
          referrerpolicy: "no-referrer-when-downgrade",
          loading: "lazy",
          style: "width:100%;border:0;border-radius:0.5rem;",
        },
      ],
    ];
  },

  addCommands() {
    return {
      setGoogleMapsEmbed:
        (options) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { src: options.src } }),
    };
  },
});
