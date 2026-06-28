// src/components/editor/extensions/oembed-block.tsx
import { Node, mergeAttributes } from "@tiptap/core";
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  type ReactNodeViewProps,
} from "@tiptap/react";

export interface OEmbedBlockOptions {
  HTMLAttributes: Record<string, string>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    oembedBlock: {
      setOEmbed: (options: {
        url: string;
        html: string;
        provider: string;
      }) => ReturnType;
    };
  }
}

// HTML was already sanitized server-side by the web's /api/oembed before storage.
function OEmbedNodeView({ node }: ReactNodeViewProps) {
  const html = (node.attrs.html as string) || "";
  const url = (node.attrs.url as string) || "";
  return (
    <NodeViewWrapper className="oembed-block" data-oembed="" data-oembed-url={url}>
      {html ? (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <div
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: "0.5rem",
            padding: "0.5rem 0.75rem",
            fontSize: "0.875rem",
            color: "var(--color-text-muted)",
          }}
        >
          Embed: {url}
        </div>
      )}
    </NodeViewWrapper>
  );
}

export const OEmbedBlock = Node.create<OEmbedBlockOptions>({
  name: "oembedBlock",
  group: "block",
  atom: true,
  draggable: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      url: { default: null },
      html: { default: null },
      provider: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-oembed]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-oembed": "",
        "data-oembed-url": node.attrs.url,
        "data-oembed-html": node.attrs.html || "",
        class: "oembed-block",
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(OEmbedNodeView);
  },

  addCommands() {
    return {
      setOEmbed:
        (options) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { url: options.url, html: options.html, provider: options.provider },
          }),
    };
  },
});
