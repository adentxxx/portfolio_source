"use client";

import { CaseImage } from "@/components/portfolio/case-image";
import { CaseVideo } from "@/components/portfolio/case-video";
import { GlassIcon } from "@/components/portfolio/glass-icon";
import type {
  CardOrigin,
  CompanyCardData,
  ProjectCardData,
  RoadmapCardData,
} from "@/components/portfolio/roadmap-card";
import { Button } from "@/components/ui/button";
import { useUi } from "@/hooks/use-locale";
import { textChunks, type TextAtom } from "@/lib/case-blocks";
import type { ContactLink } from "@/lib/content";
import { publicPath } from "@/lib/public-path";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import Image from "next/image";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

/**
 * Work and case modal (Figma Iteration 2: Work Modal 427:12645, Project Modal
 * 427:12644, phone 427:13237 and 427:12971). It grows out of the pressed card
 * and shrinks back into it. The card face (logo, date, title, tags/role,
 * description) only morphs; the rest of the body reveals as it enters the
 * scroll viewport. Header and body scroll together under two 40px fades.
 */
type Morph = CardOrigin & {
  /** Side padding. The card has one padding; the phone modal has 24 / 28. */
  padX: number;
  /** Room after the title for the close button; none on the card. */
  namePad: number;
};

const EASE = [0.22, 1, 0.36, 1] as const;
const DURATION = 0.6;

function px(value: string, fallback: number) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Body copy; each line break starts a paragraph with paragraph spacing. */
function Paragraphs({ text }: { text: string }) {
  const lines = text.split(/\n+/).filter((line) => line.trim());
  return (
    <div className="card-modal-copy card-modal-paragraphs flex flex-col text-subheadline text-text-secondary">
      {lines.map((line, index) => (
        <p key={index}>{line}</p>
      ))}
    </div>
  );
}

function Copy({ item }: { item: TextAtom }) {
  return <Paragraphs text={item.text} />;
}

/**
 * One heading group: the title2 heading and everything under it up to the
 * next heading, 16 apart. A title3 subheading and its copy up to the next
 * subheading form a tight group, 4 apart.
 */
function TextChunk({ items }: { items: TextAtom[] }) {
  const nodes: ReactNode[] = [];
  let group: TextAtom[] | null = null;
  const flush = () => {
    if (!group) return;
    const [head, ...copy] = group;
    nodes.push(
      <section key={head.id} className="card-modal-text flex flex-col">
        <h3 className="text-title3 text-text-primary">{head.text}</h3>
        {copy.map((item) => (
          <Copy key={item.id} item={item} />
        ))}
      </section>,
    );
    group = null;
  };
  for (const item of items) {
    if (item.kind === "heading") {
      flush();
      nodes.push(
        <h2 key={item.id} className="text-title2 text-text-primary">
          {item.text}
        </h2>,
      );
    } else if (item.kind === "subheading") {
      flush();
      group = [item];
    } else if (group) {
      group.push(item);
    } else {
      nodes.push(<Copy key={item.id} item={item} />);
    }
  }
  flush();
  return <div className="card-modal-chunk flex flex-col">{nodes}</div>;
}

function Tags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 text-caption1">
      {tags.map((tag) => (
        <span
          key={tag}
          className="card-tag flex items-center gap-1 rounded-lg bg-surface-inverse px-2 py-1"
        >
          <span className="text-accent-primary">#</span>
          <span className="text-text-on-inverse">{tag}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * A block of the body below the card face. Hidden until revealed: the ones
 * inside the modal's final height come in while the panel grows, the rest
 * as they scroll into view. The measuring copy marks the same boxes so the
 * first batch can be counted before anything moves.
 */
function Reveal({
  kind,
  measure,
  children,
}: {
  kind: "rise" | "lift";
  measure: boolean;
  children: ReactNode;
}) {
  if (measure) return <div data-measure-reveal>{children}</div>;
  return <div data-modal-reveal={kind}>{children}</div>;
}

/** Media in the hidden copy used for measuring: the box without the file. */
function MediaBox() {
  return <div className="card-modal-media aspect-[116/50] w-full" />;
}

function ProjectBody({
  project,
  contactLinks,
  measure,
}: {
  project: ProjectCardData;
  contactLinks: ContactLink[];
  measure: boolean;
}) {
  const lead = project.case.summary.trim() || project.description;
  const sections: ReactNode[] = [];

  if (project.case.nda) {
    if (project.case.ndaPhoto) {
      sections.push(
        <Reveal key="nda-photo" kind="lift" measure={measure}>
          {measure ? (
            <MediaBox />
          ) : (
            <CaseImage src={project.case.ndaPhoto} inModal />
          )}
        </Reveal>,
      );
    }
    sections.push(
      <Reveal key="nda" kind="rise" measure={measure}>
        <section className="card-modal-text flex flex-col">
          {project.case.ndaTitle ? (
            <h3 className="text-title3 text-text-primary">{project.case.ndaTitle}</h3>
          ) : null}
          {project.case.ndaText ? <Paragraphs text={project.case.ndaText} /> : null}
        </section>
      </Reveal>,
    );
    if (contactLinks.length > 0) {
      sections.push(
        <Reveal key="nda-links" kind="rise" measure={measure}>
          <div className="flex flex-wrap gap-3">
            {contactLinks.map((link) => (
              <Button
                key={`${link.label}-${link.href}`}
                asChild
                mode="fill"
                className="btn-fill-subtle min-w-[calc(50%-0.375rem)] flex-1"
              >
                <a
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  tabIndex={measure ? -1 : undefined}
                >
                  {link.label}
                </a>
              </Button>
            ))}
          </div>
        </Reveal>,
      );
    }
  } else {
    for (const block of project.case.blocks) {
      if (block.kind === "text") {
        for (const chunk of textChunks(block.items)) {
          sections.push(
            <Reveal key={chunk.key} kind="rise" measure={measure}>
              <TextChunk items={chunk.items} />
            </Reveal>,
          );
        }
      } else if (measure) {
        sections.push(
          <Reveal key={block.key} kind="lift" measure={measure}>
            <MediaBox />
          </Reveal>,
        );
      } else if (block.kind === "image") {
        sections.push(
          <Reveal key={block.key} kind="lift" measure={measure}>
            <CaseImage src={block.src} inModal />
          </Reveal>,
        );
      } else {
        sections.push(
          <Reveal key={block.key} kind="lift" measure={measure}>
            <CaseVideo
              src={block.src}
              autoplay={block.autoplay}
              muted={block.muted}
              loop={block.loop}
              poster={block.poster}
              controls={block.controls}
              inModal
            />
          </Reveal>,
        );
      }
    }
  }

  return (
    <>
      {/* Tags + lead come from the card: they morph with the panel, no enter. */}
      <div className="card-modal-lead flex flex-col">
        <Tags tags={project.tags} />
        {lead ? (
          <p className="card-modal-copy text-subheadline whitespace-pre-line text-text-secondary">
            {lead}
          </p>
        ) : null}
      </div>
      {sections}
    </>
  );
}

function Body({
  card,
  contactLinks,
  measure = false,
}: {
  card: RoadmapCardData;
  contactLinks: ContactLink[];
  measure?: boolean;
}) {
  if (card.kind === "company") {
    const rest = card.blocks.filter((block) => block.text.trim());
    return (
      <div className="card-modal-body flex flex-col gap-6">
        {/* Role + description are the card face: they only morph. */}
        <div className="card-modal-lead-work flex flex-col">
          {card.role.trim() ? (
            <p className="card-role text-title3 text-text-primary">{card.role}</p>
          ) : null}
          {card.description.trim() ? (
            <p className="card-modal-copy text-subheadline whitespace-pre-line text-text-secondary">
              {card.description}
            </p>
          ) : null}
        </div>
        {textChunks(rest).map((chunk) => (
          <Reveal key={chunk.key} kind="rise" measure={measure}>
            <TextChunk items={chunk.items} />
          </Reveal>
        ))}
      </div>
    );
  }

  return (
    <div className="card-modal-body card-modal-project flex flex-col gap-6">
      <ProjectBody project={card} contactLinks={contactLinks} measure={measure} />
    </div>
  );
}

/** What the card itself shows under its header, for the way back. */
function CardFace({ card }: { card: RoadmapCardData }) {
  return (
    <>
      {card.kind === "company" ? (
        card.role.trim() ? (
          <p className="card-role text-title3 text-text-primary">{card.role}</p>
        ) : null
      ) : (
        <Tags tags={card.tags} />
      )}
      {card.description.trim() ? (
        <p className="card-copy text-subheadline text-text-secondary">
          {card.description}
        </p>
      ) : null}
    </>
  );
}

export function CardModal({
  card,
  origin,
  contactLinks = [],
  onClose,
}: {
  card: RoadmapCardData;
  origin: CardOrigin;
  /** Buttons for an NDA case, from the contact block. */
  contactLinks?: ContactLink[];
  onClose: () => void;
}) {
  const titleId = useId();
  const ui = useUi();
  const dialogRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const phaseRef = useRef<"open" | "closing">("open");
  const closedRef = useRef(false);
  const [phase, setPhase] = useState<"open" | "closing">("open");
  const [target, setTarget] = useState<Morph>({
    ...origin,
    padX: origin.padding,
    namePad: 0,
  });
  const targetRef = useRef(target);
  targetRef.current = target;
  const [scrollable, setScrollable] = useState(false);
  // One-line title on the card (and in the modal for the way in): kept on
  // one line while the panel moves, or the shrinking column wraps it and
  // the header jumps a line taller just before it lands in the card.
  const [titleLines, setTitleLines] = useState({ card: false, modal: false });
  const [settled, setSettled] = useState(false);
  const [fades, setFades] = useState({ top: false, bottom: false });
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const duration = reduced ? 0 : DURATION;
  const title = card.kind === "company" ? card.name : card.title;
  const cardSelector = `[data-card-id="${typeof CSS !== "undefined" ? CSS.escape(card.id) : card.id}"]`;

  useLayoutEffect(() => {
    const main = document.querySelector("main");
    const root = document.documentElement;
    // Captured at the click. Reading window.scrollY here is already 0 once
    // the body is pinned, and a late read loses the place on the roadmap.
    const scrollY = Number.isFinite(origin.scrollY) ? origin.scrollY : window.scrollY;
    // innerWidth includes a classic scrollbar. On a phone, a too-wide element
    // inflates innerWidth the same way, and padding the body by that amount
    // shifts the whole page when the dialog opens and closes.
    const gap = window.innerWidth - root.clientWidth;
    const scrollbar = gap > 0 && gap <= 24 ? gap : 0;
    const prev = {
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      right: document.body.style.right,
      width: document.body.style.width,
      paddingRight: document.body.style.paddingRight,
    };
    // Pin the page. Right padding stands in for the scrollbar so the card
    // stays put while the panel grows out of it. The flag tells the roadmap
    // to ignore the scroll event this pin emits.
    root.dataset.scrollLock = "1";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
    main?.setAttribute("inert", "");

    const measure = measureRef.current;
    let dest: Morph = { ...origin, padX: origin.padding, namePad: 0 };
    const oneLine = (el: HTMLElement | null | undefined) => {
      if (!el) return false;
      const line = px(getComputedStyle(el).lineHeight, 0);
      return line > 0 && el.offsetHeight < line * 1.5;
    };
    const cardTitle = document.querySelector<HTMLElement>(`${cardSelector} h3`);
    if (measure) {
      const style = getComputedStyle(measure);
      const header = measure.querySelector<HTMLElement>("[data-measure-header]");
      const name = measure.querySelector<HTMLElement>("[data-measure-name]");
      const logo = measure.querySelector<HTMLElement>("[data-measure-logo]");
      const icon = logo?.querySelector("img");
      const titleEl = measure.querySelector<HTMLElement>("[data-measure-title]");
      const titleStyle = titleEl ? getComputedStyle(titleEl) : null;
      const headerStyle = header ? getComputedStyle(header) : null;
      const nameStyle = name ? getComputedStyle(name) : null;
      const logoStyle = logo ? getComputedStyle(logo) : null;
      const phone = window.innerWidth < 768;
      // 16 above and below on desktop (owner's call), 12 on a phone (Figma).
      const marginY = phone ? 12 : 16;
      const natural = measure.offsetHeight;
      const width = measure.offsetWidth;
      const height = Math.min(natural, window.innerHeight - marginY * 2);
      dest = {
        top: Math.max(marginY, (window.innerHeight - height) / 2),
        left: (window.innerWidth - width) / 2,
        width,
        height,
        radius: px(style.borderTopLeftRadius, 48),
        padding: px(style.paddingTop, 40),
        padX: px(style.paddingLeft, 40),
        gap: px(headerStyle?.marginBottom || "", 24),
        headerGap: px(headerStyle?.columnGap || headerStyle?.gap || "", 20),
        nameGap: px(nameStyle?.rowGap || nameStyle?.gap || "", 4),
        logo: logo?.offsetWidth ?? 72,
        logoRadius: px(logoStyle?.borderTopLeftRadius || "", 22),
        icon: icon?.offsetWidth ?? 44,
        titleSize: px(titleStyle?.fontSize || "", 28),
        titleLine: px(titleStyle?.lineHeight || "", 32),
        namePad: px(nameStyle?.paddingRight || "", 48),
        scrollY: origin.scrollY,
      };
      setScrollable(natural > height + 1);
      setTitleLines({ card: oneLine(cardTitle), modal: oneLine(titleEl) });

      // Blocks inside the final height come in while the panel grows, so
      // the modal is never empty waiting for the morph to end.
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const top = measure.getBoundingClientRect().top;
      const shown = [...measure.querySelectorAll<HTMLElement>("[data-measure-reveal]")].filter(
        (el) => el.getBoundingClientRect().top - top < height - 8,
      ).length;
      const live = scrollRef.current?.querySelectorAll<HTMLElement>("[data-modal-reveal]");
      live?.forEach((el, index) => {
        if (!reduce && index >= shown) return;
        el.style.setProperty("--enter", String(reduce ? 0 : 2.5 + index));
        el.dataset.revealed = "";
      });
    }
    setTarget(dest);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSettled(true);
    }

    return () => {
      main?.removeAttribute("inert");
      delete root.dataset.scrollLock;
      document.body.style.position = prev.position;
      document.body.style.top = prev.top;
      document.body.style.left = prev.left;
      document.body.style.right = prev.right;
      document.body.style.width = prev.width;
      document.body.style.paddingRight = prev.paddingRight;
      const restoreScroll = () => {
        const behavior = root.style.scrollBehavior;
        root.style.scrollBehavior = "auto";
        window.scrollTo(0, scrollY);
        root.style.scrollBehavior = behavior;
      };
      // html has scroll-behavior: smooth, which would glide back from the top.
      restoreScroll();
      const id = card.id;
      requestAnimationFrame(() => {
        restoreScroll();
        document
          .querySelector<HTMLElement>(`[data-card-id="${CSS.escape(id)}"]`)
          ?.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
      });
    };
  }, [card.id, origin]);

  // Fades show only where something is hidden: the top one once the body
  // has scrolled, the bottom one until its end is reached.
  const updateFades = () => {
    const el = scrollRef.current;
    if (!el) return;
    const top = el.scrollTop > 2;
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
    setFades((current) =>
      current.top === top && current.bottom === bottom ? current : { top, bottom },
    );
  };

  /**
   * Blocks below the first screen come in as scrolling brings them into the
   * modal; a few at once share an 80ms stagger.
   */
  const revealVisible = () => {
    const root = scrollRef.current;
    if (!root) return;
    const rootBox = root.getBoundingClientRect();
    const pending = [
      ...root.querySelectorAll<HTMLElement>("[data-modal-reveal]:not([data-revealed])"),
    ];
    let step = 0;
    for (const el of pending) {
      const box = el.getBoundingClientRect();
      const visible =
        box.top < rootBox.bottom - 8 && box.bottom > rootBox.top + 8;
      if (!visible) break;
      el.style.setProperty("--enter", String(step));
      el.dataset.revealed = "";
      step += 1;
    }
  };

  useEffect(() => {
    if (!settled) return;
    updateFades();
    revealVisible();
    const root = scrollRef.current;
    if (!root) return;
    const onScroll = () => {
      updateFades();
      revealVisible();
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled]);

  // Focus moves into the dialog itself, not onto the close button: a
  // focused button draws the accent ring whenever the last input was a key
  // (Escape on the previous modal), with nobody having tabbed to it.
  useEffect(() => {
    if (settled) dialogRef.current?.focus({ preventScroll: true });
  }, [settled]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const focusable = [
        ...root.querySelectorAll<HTMLElement>("button, [href], [tabindex], video"),
      ].filter((el) => !el.hasAttribute("disabled") && el.tabIndex >= 0);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id]);

  function requestClose() {
    if (phaseRef.current === "closing") return;
    phaseRef.current = "closing";
    const cardEl = document.querySelector<HTMLElement>(cardSelector);
    if (cardEl) {
      cardEl.dataset.focusReturn = "";
      cardEl.addEventListener(
        "blur",
        () => {
          delete cardEl.dataset.focusReturn;
        },
        { once: true },
      );
    }
    if (reduced) {
      onCloseRef.current();
      return;
    }
    // Back to the top first, so the card face lines up with the body.
    scrollRef.current?.scrollTo({ top: 0 });
    setPhase("closing");
    setSettled(false);
    const box = cardEl?.getBoundingClientRect();
    setTarget({
      ...origin,
      padX: origin.padding,
      namePad: 0,
      top: box?.top ?? origin.top,
      left: box?.left ?? origin.left,
      width: box?.width ?? origin.width,
      height: box?.height ?? origin.height,
    });
  }

  const moving = { duration, ease: EASE };
  const open = phase === "open";

  return createPortal(
    <>
      {/* Invisible copy at the final size: its height decides the modal's. */}
      <div
        ref={measureRef}
        aria-hidden
        inert
        className="card-modal pointer-events-none invisible fixed top-0 left-0 -z-10 flex flex-col"
      >
        <div data-measure-header className="card-modal-header flex items-center">
          <span
            data-measure-logo
            className="card-modal-logo flex shrink-0 items-center justify-center"
          >
            {card.logoSrc ? (
              <Image
                src={publicPath(card.logoSrc)}
                alt=""
                width={72}
                height={72}
                className="size-full object-cover"
                unoptimized
              />
            ) : null}
          </span>
          <div data-measure-name className="card-modal-name flex min-w-0 flex-1 flex-col">
            <span className="card-modal-date text-caption1">{card.dateLabel}</span>
            <span data-measure-title className="card-modal-title text-title1">
              {title}
            </span>
          </div>
        </div>
        <Body card={card} contactLinks={contactLinks} measure />
      </div>

      <motion.div
        className="fixed inset-0 z-[60] bg-surface-overlay-dark backdrop-blur-[20px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: open ? 1 : 0 }}
        transition={moving}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          requestClose();
        }}
      />

      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-card-dialog
        tabIndex={-1}
        className="fixed z-[61] outline-none"
        initial={false}
        animate={{
          top: target.top,
          left: target.left,
          width: target.width,
          height: target.height,
        }}
        transition={moving}
        onAnimationComplete={() => {
          const panel = dialogRef.current;
          const goal = targetRef.current;
          if (!panel) return;
          const box = panel.getBoundingClientRect();
          // An interrupted flight can report completion before the panel
          // has reached the rect this phase is aiming at.
          const arrived =
            Math.abs(box.top - goal.top) < 3 &&
            Math.abs(box.left - goal.left) < 3 &&
            Math.abs(box.width - goal.width) < 3 &&
            Math.abs(box.height - goal.height) < 3;
          if (!arrived) return;
          if (phaseRef.current === "closing") {
            if (closedRef.current) return;
            closedRef.current = true;
            onCloseRef.current();
          } else setSettled(true);
        }}
      >
        <motion.div
          className="absolute inset-0 overflow-hidden bg-surface-card"
          initial={false}
          animate={{
            borderRadius: target.radius,
            // Native scrollbars ignore ancestor overflow+radius in Chromium;
            // clip-path keeps the track inside the rounded corner.
            clipPath: `inset(0 round ${target.radius}px)`,
          }}
          transition={moving}
        >
          {/* Header and body scroll together; the fades stay on the panel. */}
          <div
            ref={scrollRef}
            className="card-modal-scroll h-full overscroll-contain"
            style={{ overflowY: settled && scrollable ? "auto" : "hidden" }}
          >
            <motion.div
              initial={false}
              animate={{ paddingTop: target.padding }}
              transition={moving}
            >
              <motion.div
                className="flex items-center"
                initial={false}
                animate={{ paddingLeft: target.padX, paddingRight: target.padX }}
                transition={moving}
              >
                <motion.span
                  className="flex shrink-0 items-center justify-center overflow-hidden bg-surface-page"
                  initial={false}
                  animate={{
                    width: target.logo,
                    height: target.logo,
                    borderRadius: target.logoRadius,
                  }}
                  transition={moving}
                >
                  {card.logoSrc ? (
                    <motion.span
                      className="relative block"
                      initial={false}
                      animate={{ width: target.icon, height: target.icon }}
                      transition={moving}
                    >
                      <Image
                        src={publicPath(card.logoSrc)}
                        alt=""
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </motion.span>
                  ) : null}
                </motion.span>
                <motion.div
                  className="flex min-w-0 flex-1 flex-col"
                  initial={false}
                  animate={{ marginLeft: target.headerGap, paddingRight: target.namePad }}
                  transition={moving}
                >
                  <span className="card-modal-date text-caption1 text-text-muted">
                    {card.dateLabel}
                  </span>
                  <motion.h2
                    id={titleId}
                    className={cn(
                      "text-title1 font-normal text-text-primary",
                      !settled &&
                        titleLines.card &&
                        (!open || titleLines.modal) &&
                        "truncate",
                    )}
                    initial={false}
                    animate={{
                      fontSize: target.titleSize,
                      lineHeight: `${target.titleLine}px`,
                      marginTop: target.nameGap,
                    }}
                    transition={moving}
                  >
                    {title}
                  </motion.h2>
                </motion.div>
              </motion.div>

              <motion.div
                className="relative"
                initial={false}
                animate={{ marginTop: target.gap }}
                transition={moving}
              >
                {/* Opening: each block brings itself in (blockEnter).
                    Closing: the whole body fades as the panel shrinks. */}
                <motion.div
                  initial={false}
                  animate={{
                    opacity: open ? 1 : 0,
                    paddingLeft: target.padX,
                    paddingRight: target.padX,
                  }}
                  transition={moving}
                >
                  <Body card={card} contactLinks={contactLinks} />
                </motion.div>

                {/* The card's own face: it fades out as the blocks come in,
                    and back in on the way into the card. */}
                <motion.div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2"
                  initial={{
                    opacity: 1,
                    paddingLeft: origin.padding,
                    paddingRight: origin.padding,
                  }}
                  animate={{
                    opacity: open ? 0 : 1,
                    paddingLeft: target.padX,
                    paddingRight: target.padX,
                  }}
                  transition={
                    open ? { ...moving, duration: duration * 0.5 } : moving
                  }
                >
                  <CardFace card={card} />
                </motion.div>
              </motion.div>
            </motion.div>
          </div>

          <div
            aria-hidden
            className={cn("card-modal-fade card-modal-fade-top", fades.top && settled && "is-on")}
          />
          <div
            aria-hidden
            className={cn(
              "card-modal-fade card-modal-fade-bottom",
              fades.bottom && settled && "is-on",
            )}
          />
        </motion.div>

        {/* Glass close, inside the modal's corner (Figma: 16 in, 64; phone 8 in, 52).
            It grows in by scale: opacity on glass would drop its blur. */}
        <motion.div
          className="card-modal-close-slot absolute"
          initial={{ scale: 0 }}
          animate={{ scale: open && settled ? 1 : 0 }}
          transition={{
            duration: reduced ? 0 : open ? 0.42 : 0.16,
            ease: open ? [0.3, 1.35, 0.5, 1] : EASE,
          }}
          style={{ pointerEvents: settled && open ? "auto" : "none" }}
        >
          <button
            type="button"
            aria-label={ui.close}
            className="glass glass-button card-modal-close"
            onClick={requestClose}
          >
            <GlassIcon name="close" />
          </button>
        </motion.div>
      </motion.div>
    </>,
    document.body,
  );
}
