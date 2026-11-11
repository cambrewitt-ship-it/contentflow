'use client';

import { useEffect, useRef } from 'react';

/**
 * Ambient atmospheric background — the app's "living" backdrop.
 *
 * Purely decorative and isolated from the rest of the app:
 * - Rendered once in the root layout, fixed behind all content (z-index -1),
 *   pointer-events: none, aria-hidden.
 * - Ambient drift is pure CSS (transform keyframes on a few large radial
 *   gradients, see "Ambient background" in globals.css).
 * - Mouse glow and click pulses are driven imperatively (refs, CSS variables,
 *   requestAnimationFrame, Web Animations API) — no React state, so moving the
 *   mouse never re-renders anything.
 * - Mouse glow only on devices with a fine, hovering pointer; touch is never
 *   tracked. Everything interactive is off under prefers-reduced-motion.
 */

// Anything the user can interact with: clicks here never trigger a pulse.
const INTERACTIVE_SELECTOR = [
  'a',
  'button',
  'input',
  'textarea',
  'select',
  'option',
  'label',
  'summary',
  'details',
  'video',
  'audio',
  'canvas',
  'iframe',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
  '[role="button"]',
  '[role="link"]',
  '[role="menu"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  '[role="option"]',
  '[role="listbox"]',
  '[role="combobox"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="tab"]',
  '[role="slider"]',
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[draggable="true"]',
  '[data-no-ambient-pulse]',
].join(',');

const MAX_PULSES = 3;

export default function AmbientBackground() {
  const rootRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const glow = glowRef.current;
    if (!root || !glow) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

    // ── Cursor glow: eases toward the pointer, never snaps to it ────────
    let targetX = window.innerWidth * 0.5;
    let targetY = window.innerHeight * 0.35;
    let x = targetX;
    let y = targetY;
    let frame = 0;
    let glowVisible = false;

    const setGlowVisible = (visible: boolean) => {
      if (visible === glowVisible) return;
      glowVisible = visible;
      glow.style.opacity = visible ? '1' : '0';
    };

    const tick = () => {
      // Low easing factor = soft, delayed, organic follow
      x += (targetX - x) * 0.045;
      y += (targetY - y) * 0.045;
      glow.style.setProperty('--ambient-glow-x', `${x.toFixed(1)}px`);
      glow.style.setProperty('--ambient-glow-y', `${y.toFixed(1)}px`);
      // Stop the loop once settled; the next pointer move restarts it
      if (Math.abs(targetX - x) > 0.5 || Math.abs(targetY - y) > 0.5) {
        frame = requestAnimationFrame(tick);
      } else {
        frame = 0;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return; // never track touch or pen
      targetX = e.clientX;
      targetY = e.clientY;
      setGlowVisible(true);
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const onPointerLeave = () => setGlowVisible(false);

    // ── Click pulse: soft ring of light from background clicks ──────────
    const activePulses = new Set<HTMLElement>();

    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.defaultPrevented) return;
      const target = e.target as Element | null;
      if (!target || !(target instanceof Element)) return;
      if (target.closest(INTERACTIVE_SELECTOR)) return;
      // Text being selected is not a background click
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) return;
      if (getComputedStyle(target).cursor === 'pointer') return;
      if (activePulses.size >= MAX_PULSES) return;

      const pulse = document.createElement('span');
      pulse.className = 'ambient-pulse';
      pulse.style.left = `${e.clientX}px`;
      pulse.style.top = `${e.clientY}px`;
      root.appendChild(pulse);
      activePulses.add(pulse);

      const remove = () => {
        activePulses.delete(pulse);
        pulse.remove();
      };
      if (typeof pulse.animate === 'function') {
        const anim = pulse.animate(
          [
            { transform: 'translate(-50%, -50%) scale(0.15)', opacity: 0 },
            { transform: 'translate(-50%, -50%) scale(0.45)', opacity: 1, offset: 0.18 },
            { transform: 'translate(-50%, -50%) scale(1)', opacity: 0 },
          ],
          { duration: 1600, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
        );
        anim.onfinish = remove;
        anim.oncancel = remove;
      } else {
        remove();
      }
    };

    // ── Wire up according to the user's motion / pointer preferences ────
    let listening = false;
    const attach = () => {
      if (listening) return;
      listening = true;
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      document.documentElement.addEventListener('pointerleave', onPointerLeave);
      window.addEventListener('blur', onPointerLeave);
      document.addEventListener('click', onClick, { passive: true });
    };
    const detach = () => {
      if (!listening) return;
      listening = false;
      window.removeEventListener('pointermove', onPointerMove);
      document.documentElement.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('blur', onPointerLeave);
      document.removeEventListener('click', onClick);
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      setGlowVisible(false);
    };
    const sync = () => {
      if (!reducedMotion.matches && finePointer.matches) attach();
      else detach();
    };

    sync();
    reducedMotion.addEventListener('change', sync);
    finePointer.addEventListener('change', sync);

    return () => {
      detach();
      reducedMotion.removeEventListener('change', sync);
      finePointer.removeEventListener('change', sync);
      activePulses.forEach((p) => p.remove());
      activePulses.clear();
    };
  }, []);

  return (
    <div ref={rootRef} className="ambient-bg" aria-hidden="true">
      <div className="ambient-blob ambient-blob--1" />
      <div className="ambient-blob ambient-blob--2" />
      <div className="ambient-blob ambient-blob--3" />
      <div className="ambient-blob ambient-blob--4" />
      <div ref={glowRef} className="ambient-glow" />
    </div>
  );
}
