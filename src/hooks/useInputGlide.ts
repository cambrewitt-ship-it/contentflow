'use client';

import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react';

/**
 * FLIP glide for Chat caption mode: the "Generate Text" prompt box sits at the top until the
 * first generation, then the chat window opens and the refine input takes over at the bottom.
 * Call `captureStart()` just before starting the chat; when `show` (chat window visible) flips
 * on, the refine input slides from where the prompt box was down to its new place, and the
 * chat window (`revealRef`) and input hint fade in.
 *
 * Attach `anchorRef` to something above both boxes that stays mounted (e.g. the mode toggle row),
 * `fromRef` to the prompt box, `toRef` to the refine input and `hintRef` to its hint line.
 */
export function useInputGlide(show: boolean, revealRef?: RefObject<HTMLElement | null>) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const fromRef = useRef<HTMLDivElement>(null);
  const toRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const pendingOffsetRef = useRef<number | null>(null);

  const captureStart = useCallback(() => {
    const from = fromRef.current?.getBoundingClientRect();
    const anchor = anchorRef.current?.getBoundingClientRect();
    pendingOffsetRef.current = from && anchor ? from.top - anchor.top : null;
  }, []);

  useLayoutEffect(() => {
    const startOffset = pendingOffsetRef.current;
    pendingOffsetRef.current = null;
    if (!show || startOffset === null) return;
    const input = toRef.current;
    const anchor = anchorRef.current;
    if (!input || !anchor) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const delta = startOffset - (input.getBoundingClientRect().top - anchor.getBoundingClientRect().top);
    const easing = 'cubic-bezier(0.22, 1, 0.36, 1)';
    input.animate(
      [{ transform: `translateY(${delta}px)` }, { transform: 'translateY(0)' }],
      { duration: 600, easing }
    );
    revealRef?.current?.animate(
      [{ opacity: 0, transform: 'translateY(-12px) scale(0.98)' }, { opacity: 1, transform: 'none' }],
      { duration: 500, delay: 120, easing, fill: 'backwards' }
    );
    hintRef.current?.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: 300, delay: 450, fill: 'backwards' }
    );
  }, [show, revealRef]);

  return { anchorRef, fromRef, toRef, hintRef, captureStart };
}
