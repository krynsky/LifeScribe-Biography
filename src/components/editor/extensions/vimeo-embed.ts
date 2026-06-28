// src/components/editor/extensions/vimeo-embed.ts
import { Node, nodePasteRule } from "@tiptap/core";

export interface VimeoEmbedOptions {
  HTMLAttributes: Record<string, string>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    vimeoEmbed: {
      setVimeoEmbed: (options: { src: string }) => ReturnType;
    };
  }
}

const VIMEO_REGEX_PASTE =
  /^https?:\/\/(?:www\.)?(?:vimeo\.com\/(\d+)(?:\/[a-zA-Z0-9]+)?|player\.vimeo\.com\/video\/(\d+))(?:\?.*)?$/g;

export const VimeoEmbed = Node.create<VimeoEmbedOptions>({
  name: "vimeoEmbed",
  group: "block",
  atom: true,
  draggable: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      src: { default: null },
      width: { default: 640 },
      height: { default: 360 },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-vimeo-embed]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const videoId = HTMLAttributes.src?.match(/\/video\/(\d+)/)?.[1];
    return [
      "div",
      {
        "data-vimeo-embed": "",
        style:
          "position:relative;padding-bottom:56.25%;height:0;overflow:hidden;margin:1rem 0;",
      },
      [
        "iframe",
        {
          src: videoId
            ? `https://player.vimeo.com/video/${videoId}`
            : HTMLAttributes.src,
          width: HTMLAttributes.width,
          height: HTMLAttributes.height,
          frameborder: "0",
          allowfullscreen: "true",
          allow: "autoplay; fullscreen; picture-in-picture",
          style:
            "position:absolute;top:0;left:0;width:100%;height:100%;border-radius:0.5rem;",
        },
      ],
    ];
  },

  addCommands() {
    return {
      setVimeoEmbed:
        (options) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { src: options.src } }),
    };
  },

  addPasteRules() {
    return [
      nodePasteRule({
        find: VIMEO_REGEX_PASTE,
        type: this.type,
        getAttributes: (match) => {
          const id = match[1] || match[2];
          return { src: `https://player.vimeo.com/video/${id}` };
        },
      }),
    ];
  },
});
