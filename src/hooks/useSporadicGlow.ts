'use client';

import { useEffect, useState } from 'react';

// Sweep length must match the prompt-glow-sweep animation in globals.css
const GLOW_SWEEP_MS = 2800;
const GLOW_REST_MIN_MS = 4000;
const GLOW_REST_MAX_MS = 11000;

/**
 * Drives the `.prompt-glow` border sweep: one sweep, then a random rest, so it
 * feels sporadic rather than a metronome. Spread the result onto the element
 * with the `prompt-glow` class as `data-glow`. Pass `paused` to stop it (e.g.
 * while the user is typing).
 */
export function useSporadicGlow(paused = false): 'on' | 'off' {
  const [glowOn, setGlowOn] = useState(false);

  useEffect(() => {
    if (paused) {
      setGlowOn(false);
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const rest = () => GLOW_REST_MIN_MS + Math.random() * (GLOW_REST_MAX_MS - GLOW_REST_MIN_MS);
    const sweep = () => {
      setGlowOn(true);
      timer = setTimeout(() => {
        setGlowOn(false);
        timer = setTimeout(sweep, rest());
      }, GLOW_SWEEP_MS);
    };
    timer = setTimeout(sweep, 700);
    return () => clearTimeout(timer);
  }, [paused]);

  return glowOn ? 'on' : 'off';
}
