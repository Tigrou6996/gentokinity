import { useEffect, useRef, useState } from "react";
import type { ComponentProps, ReactNode } from "react";
import {
  animate,
  AnimatePresence,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type Transition,
} from "motion/react";
import { cn } from "../lib/utils";

// ── geometry constants ──────────────────────────────────────────────────────
const HINGE       = "3px 6px";
const LID_OPEN    = -35;
const WALL_TOP    = 6;
const WALL_TOP_OPEN = 13.5;
const WALL_BASE   = 20;
const TILE        = 48;
const PANEL       = 84;
const HOLD        = { closed: 1400, kept: 600 };

// ── easing ──────────────────────────────────────────────────────────────────
const EASE     = [0.32, 0.72, 0, 1] as const;
const EASE_LID = [0.34, 1.1, 0.64, 1] as const;

const WIDTH  = { duration: 0.62, ease: EASE } as const;
const LID    = { duration: 0.6,  ease: EASE_LID } as const;
const WALL   = { duration: 0.56, ease: EASE } as const;
const IN     = { duration: 0.44, ease: EASE, delay: 0.14 } as const;
const OUT    = { duration: 0.3,  ease: EASE } as const;
const TAP    = { duration: 0.2,  ease: EASE } as const;
const SWAP   = { duration: 0.22, ease: EASE } as const;
const SETTLE = { duration: 0.45, ease: EASE } as const;
const PRESS  = { type: "spring", stiffness: 520, damping: 18, mass: 0.5 } as const;
const INSTANT = { duration: 0 } as const;

// ── LBS palette (comic style) ───────────────────────────────────────────────
const SURFACE = "bg-white dark:bg-[#1a0d20]";
const RECESS  = "bg-[#F5F0F7] dark:bg-[#2a1532]";
const GLYPH   = "text-[#6E4274] dark:text-[#9B6FA3]";
const ACCENT  = "#6E4274";
const BORDER  = "border-2 border-[#3D2045]";
const FOCUS   = "outline-none focus-visible:ring-2 focus-visible:ring-[#6E4274]";

const LIFT =
  "shadow-[0_0.5px_1px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.12),inset_0_0.5px_0_rgba(255,255,255,0.9)] dark:shadow-[0_0.5px_1px_rgba(0,0,0,0.35),0_1.5px_4px_rgba(0,0,0,0.25),inset_0_0.5px_0_rgba(255,255,255,0.07)]";

const CIRCLE = `grid h-7 w-7 place-items-center rounded-full transition-colors duration-200 hover:bg-[#F5F0F7] dark:hover:bg-[#3D2045] ${FOCUS} ${SURFACE} ${LIFT} ${BORDER}`;

const ICON = {
  viewBox: "0 0 24 24",
  fill: "none",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};

// ── animation variants ──────────────────────────────────────────────────────
const panelMotion = {
  hidden: { opacity: 0, x: -6, transition: OUT },
  shown:  { opacity: 1, x: 0,  transition: { ...IN, staggerChildren: 0.07 } },
};

const circleMotion = {
  hidden: { opacity: 0, scale: 0.9, transition: OUT },
  shown:  { opacity: 1, scale: 1,   transition: IN },
};

// ── Circle sub-button ───────────────────────────────────────────────────────
function Circle({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  const reduced = useReducedMotion() ?? false;

  return (
    <motion.div className="flex" variants={reduced ? undefined : circleMotion}>
      <motion.button
        type="button"
        aria-label={label}
        onClick={onClick}
        whileHover={reduced ? undefined : { scale: 1.06 }}
        whileTap={reduced  ? undefined : { scale: 0.84 }}
        transition={PRESS}
        className={CIRCLE}
      >
        <svg {...ICON} width="14" height="14" stroke="currentColor" strokeWidth="3.5">
          {children}
        </svg>
      </motion.button>
    </motion.div>
  );
}

// ── status type ─────────────────────────────────────────────────────────────
type Status = "idle" | "closed" | "kept";

// ── public API ───────────────────────────────────────────────────────────────
export type CloseButtonProps = Omit<
  ComponentProps<"div">,
  "onAnimationStart" | "onDrag" | "onDragStart" | "onDragEnd"
> & {
  /** Called when the user confirms closing */
  onConfirm?: () => void;
  /** Called when the user cancels (escape / ✕) */
  onCancel?:  () => void;
};

/**
 * Animated close/dismiss button with a confirm panel.
 *
 * Usage:
 *   <CloseButton onConfirm={() => setShowModal(false)} />
 */
export function CloseButton({
  className,
  onConfirm,
  onCancel,
  ...props
}: CloseButtonProps) {
  const reduced = useReducedMotion() ?? false;
  const [open,   setOpen]   = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const trigger = useRef<HTMLButtonElement>(null);

  const timing = (t: Transition) => (reduced ? INSTANT : t);

  // ── bin-wall animation ──────────────────────────────────────────────────
  const top  = useMotionValue(WALL_TOP);
  const wall = useTransform(top, (y) => WALL_BASE - y);
  const bin  = useMotionTemplate`M19 ${top}v${wall}a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V${top}`;
  const settle = useMotionValue(1);

  useEffect(() => {
    const walls = animate(top, open ? WALL_TOP_OPEN : WALL_TOP, reduced ? INSTANT : WALL);
    return () => walls.stop();
  }, [open, reduced, top]);

  useEffect(() => {
    if (status === "idle") return;
    const nudge =
      status === "kept" && !reduced
        ? animate(settle, [1, 0.86, 1], SETTLE)
        : null;
    const done = setTimeout(() => setStatus("idle"), HOLD[status]);
    return () => { nudge?.stop(); clearTimeout(done); };
  }, [status, reduced, settle]);

  // ── resolve action ─────────────────────────────────────────────────────
  const resolve = (next: Exclude<Status, "idle">) => {
    setOpen(false);
    setStatus(next);
    trigger.current?.focus();
    (next === "closed" ? onConfirm : onCancel)?.();
  };

  return (
    <motion.div
      data-slot="close-button"
      data-state={open ? "open" : "closed"}
      data-status={status}
      className={cn("relative h-12 rounded-xl", SURFACE, GLYPH, className)}
      animate={{ width: open ? TILE + PANEL : TILE }}
      transition={timing(WIDTH)}
      onKeyDown={(e) => { if (e.key === "Escape" && open) resolve("kept"); }}
      {...props}
    >
      {/* ── main trigger ── */}
      <motion.button
        ref={trigger}
        type="button"
        aria-label="Chiudi"
        aria-expanded={open}
        onClick={() => {
          if (open) return resolve("kept");
          setStatus("idle");
          setOpen(true);
        }}
        whileTap={reduced ? undefined : { scale: 0.94 }}
        transition={TAP}
        className={cn(
          "relative z-10 grid h-12 w-12 place-items-center rounded-xl",
          FOCUS,
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          {status === "closed" ? (
            // ✔ done state
            <motion.svg
              key="done"
              {...ICON}
              width="20"
              height="20"
              stroke={ACCENT}
              strokeWidth="2.5"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={timing(SWAP)}
            >
              <motion.path
                d="M4 12.5 9.5 18 20 7"
                initial={reduced ? undefined : { pathLength: 0 }}
                animate={reduced ? undefined : { pathLength: 1 }}
                transition={SETTLE}
              />
            </motion.svg>
          ) : (
            // 🗑 bin icon
            <motion.svg
              key="bin"
              {...ICON}
              width="20"
              height="20"
              stroke="currentColor"
              strokeWidth="2"
              className="overflow-visible"
              style={{ scale: settle }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={timing(SWAP)}
            >
              <motion.path d={bin} />
              <motion.g
                style={{ transformBox: "view-box", transformOrigin: HINGE }}
                animate={{ rotate: open ? LID_OPEN : 0 }}
                transition={timing(LID)}
              >
                <path d="M3 6h18" />
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </motion.g>
            </motion.svg>
          )}
        </AnimatePresence>
      </motion.button>

      {/* a11y live region */}
      <span role="status" aria-live="polite" className="sr-only">
        {status === "closed" ? "Chiuso" : status === "kept" ? "Annullato" : ""}
      </span>

      {/* ── confirm panel ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            style={{ width: PANEL }}
            className={cn(
              "absolute inset-y-0 right-0 flex items-center justify-center gap-2 rounded-xl",
              RECESS,
            )}
            variants={reduced ? undefined : panelMotion}
            initial="hidden"
            animate="shown"
            exit="hidden"
          >
            {/* left arrow */}
            <span
              aria-hidden
              className={cn(
                "absolute -left-1.5 top-1/2 z-20 h-3 w-2 -translate-y-1/2 [clip-path:polygon(100%_0,0_50%,100%_100%)]",
                RECESS,
              )}
            />
            {/* ✔ confirm */}
            <Circle label="Conferma chiusura" onClick={() => resolve("closed")}>
              <path d="M4 12.5 9.5 18 20 7" stroke={ACCENT} />
            </Circle>
            {/* ✕ cancel */}
            <Circle label="Annulla" onClick={() => resolve("kept")}>
              <path d="M6 6 18 18M18 6 6 18" />
            </Circle>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default CloseButton;
