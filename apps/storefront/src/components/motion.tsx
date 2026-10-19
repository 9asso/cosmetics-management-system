"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";

/** Becomes true once the element scrolls into view (and stays true). */
export function useInView<T extends Element>(rootMargin = "0px 0px -12% 0px") {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || inView) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold: 0.08 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [inView, rootMargin]);
  return [ref, inView] as const;
}

/** Fades and lifts its children in when scrolled into view. */
export function Reveal({
  as: Tag = "div",
  children,
  className = "",
  delay = 0,
  variant = "up",
  id,
  style,
  ...rest
}: {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  delay?: number;
  variant?: "up" | "fade" | "zoom" | "left" | "right";
  id?: string;
  style?: CSSProperties;
  "aria-label"?: string;
}) {
  const [ref, inView] = useInView<HTMLElement>();
  return (
    <Tag
      ref={ref}
      id={id}
      className={`reveal reveal-${variant} ${inView ? "is-in" : ""} ${className}`}
      style={{ ...style, "--reveal-delay": `${delay}ms` } as CSSProperties}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Counts from 0 to `value` with an ease-out curve once visible. */
export function CountUp({ value, duration = 1600, suffix = "" }: { value: number; duration?: number; suffix?: string }) {
  const [ref, inView] = useInView<HTMLSpanElement>();
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!inView) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      setShown(Math.round(value * (1 - Math.pow(1 - progress, 4))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, inView, value]);
  return (
    <span ref={ref}>
      {shown.toLocaleString("fr-FR")}
      {suffix && <small className="count-suffix">{suffix}</small>}
    </span>
  );
}

/** Horizontal scroller with arrow buttons, drag-to-scroll and a progress bar. */
export function useRail<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [state, setState] = useState({ progress: 0, ratio: 1, atStart: true, atEnd: false });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = () => {
      const max = node.scrollWidth - node.clientWidth;
      setState({
        progress: max > 0 ? node.scrollLeft / max : 0,
        ratio: node.scrollWidth ? Math.min(1, node.clientWidth / node.scrollWidth) : 1,
        atStart: node.scrollLeft <= 4,
        atEnd: node.scrollLeft >= max - 4,
      });
    };
    update();
    node.addEventListener("scroll", update, { passive: true });
    const resize = new ResizeObserver(update);
    resize.observe(node);

    // Mouse drag to scroll; touch devices keep native momentum scrolling.
    let startX = 0;
    let startScroll = 0;
    let dragging = false;
    let moved = false;
    const down = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      dragging = true;
      moved = false;
      startX = event.clientX;
      startScroll = node.scrollLeft;
    };
    const move = (event: PointerEvent) => {
      if (!dragging) return;
      const delta = event.clientX - startX;
      if (Math.abs(delta) > 6 && !moved) {
        moved = true;
        node.classList.add("is-dragging");
      }
      if (moved) node.scrollLeft = startScroll - delta;
    };
    const up = () => {
      dragging = false;
      node.classList.remove("is-dragging");
    };
    // Swallow the click that ends a drag so cards don't open by accident.
    const click = (event: MouseEvent) => {
      if (moved) {
        event.preventDefault();
        event.stopPropagation();
        moved = false;
      }
    };
    node.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    node.addEventListener("click", click, true);
    return () => {
      node.removeEventListener("scroll", update);
      resize.disconnect();
      node.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      node.removeEventListener("click", click, true);
    };
  }, []);

  const scrollBy = (direction: 1 | -1) => {
    const node = ref.current;
    if (!node) return;
    node.scrollBy({ left: direction * node.clientWidth * 0.85, behavior: "smooth" });
  };
  return { ref, ...state, scrollBy };
}
