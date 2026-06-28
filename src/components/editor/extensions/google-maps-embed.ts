// src/components/editor/extensions/google-maps-embed.ts
import { Node } from "@tiptap/core";

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
          src: HTMLAttributes.src,
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
