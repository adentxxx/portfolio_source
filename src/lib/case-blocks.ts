import { isSafePublicPath } from "@/lib/content-format";

/**
 * A case page as a list of blocks: runs of text, and photos or videos
 * between them. Shared by the case page and the case modal on the home page.
 */
export type TextAtom = {
  id: string;
  kind: "heading" | "subheading" | "paragraph";
  text: string;
};

export type ImageAtom = { kind: "image"; key: string; src: string };

export type VideoAtom = {
  kind: "video";
  key: string;
  src: string;
  autoplay: boolean;
  muted: boolean;
  loop: boolean;
  poster: string | null;
  controls: boolean;
};

export type MediaAtom = ImageAtom | VideoAtom;

export type CaseBlock =
  | MediaAtom
  | { kind: "text"; key: string; items: TextAtom[] };

export type CaseSection = {
  id: string;
  kind: string;
  heading: string;
  body: string;
  text: string;
  imageSrc: string | null;
  videoAutoplay?: boolean;
  videoMuted?: boolean;
  videoLoop?: boolean;
  videoPoster?: string | null;
  videoControls?: boolean;
};

export function caseBlocks(project: {
  heroImage: string;
  sections: CaseSection[];
}): CaseBlock[] {
  const atoms: (MediaAtom | TextAtom)[] = [];
  const heroInSections = project.sections.some(
    (section) => section.imageSrc && section.imageSrc === project.heroImage,
  );
  if (project.heroImage && !heroInSections) {
    atoms.push({ kind: "image", key: "hero", src: project.heroImage });
  }

  for (const section of project.sections) {
    if (section.kind === "image" || section.kind === "video") {
      if (section.imageSrc) {
        atoms.push(
          section.kind === "video"
            ? {
                kind: "video",
                key: section.id,
                src: section.imageSrc,
                autoplay: Boolean(section.videoAutoplay),
                muted: Boolean(section.videoAutoplay || section.videoMuted),
                loop: Boolean(section.videoLoop),
                poster:
                  section.videoPoster && isSafePublicPath(section.videoPoster)
                    ? section.videoPoster
                    : null,
                controls: section.videoControls !== false,
              }
            : { kind: "image", key: section.id, src: section.imageSrc },
        );
      }
      continue;
    }
    if (section.kind === "subheading" || section.kind === "heading") {
      const text = section.text || section.heading;
      if (text) atoms.push({ id: section.id, kind: section.kind, text });
      continue;
    }
    if (section.kind === "paragraph") {
      const text = section.text || section.body;
      if (text) atoms.push({ id: section.id, kind: "paragraph", text });
      continue;
    }
    if (section.heading) {
      atoms.push({
        id: `${section.id}-h`,
        kind: "heading",
        text: section.heading,
      });
    }
    if (section.body) {
      atoms.push({
        id: `${section.id}-b`,
        kind: "paragraph",
        text: section.body,
      });
    }
    if (section.imageSrc) {
      atoms.push({
        kind: "image",
        key: `${section.id}-i`,
        src: section.imageSrc,
      });
    }
  }

  const blocks: CaseBlock[] = [];
  let texts: TextAtom[] = [];
  const flush = () => {
    if (texts.length === 0) return;
    blocks.push({
      kind: "text",
      key: texts.map((item) => item.id).join("-"),
      items: texts,
    });
    texts = [];
  };
  for (const atom of atoms) {
    if (atom.kind === "image" || atom.kind === "video") {
      flush();
      blocks.push(atom);
      continue;
    }
    texts.push(atom);
  }
  flush();
  return blocks;
}

/** Text items grouped so each heading starts a new section. */
export function textChunks(items: TextAtom[]) {
  const chunks: { key: string; items: TextAtom[] }[] = [];
  for (const item of items) {
    const last = chunks[chunks.length - 1];
    if (!last || item.kind === "heading") {
      chunks.push({ key: item.id, items: [item] });
      continue;
    }
    last.items.push(item);
    last.key = `${last.key}-${item.id}`;
  }
  return chunks;
}
