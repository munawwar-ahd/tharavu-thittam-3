import { useEffect, useRef, useState } from 'react';

// Total frames in the Frames directory (1-indexed: 001 through 240)
const TOTAL_FRAMES = 240;

function getFramePath(index: number): string {
  const num = String(index).padStart(3, '0');
  return `/Frames/ezgif-frame-${num}.jpg`;
}

interface ScrollBackgroundProps {
  /** Scroll progress from 0 to 1, controlled externally */
  progress: number;
  /** Respect prefers-reduced-motion */
  reducedMotion?: boolean;
}

/**
 * Scroll-driven frame animation background.
 * Renders a fixed canvas at z-index 0 behind all page content.
 * Maps scroll progress [0,1] → frame index [1, TOTAL_FRAMES].
 * Uses an image cache and requestAnimationFrame for smooth updates.
 */
export function ScrollBackground({ progress, reducedMotion = false }: ScrollBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameCacheRef = useRef<Map<number, HTMLImageElement>>(new Map());
  const loadingRef = useRef<Set<number>>(new Set());
  const currentFrameRef = useRef<number>(-1); // -1 = not yet rendered
  const rafRef = useRef<number | null>(null);
  const progressRef = useRef<number>(progress);
  const reducedMotionRef = useRef<boolean>(reducedMotion);
  const [firstFrameReady, setFirstFrameReady] = useState(false);

  // Keep refs in sync with props to avoid stale closures
  progressRef.current = progress;
  reducedMotionRef.current = reducedMotion;

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const loadFrame = (index: number): void => {
    if (frameCacheRef.current.has(index)) return;
    if (loadingRef.current.has(index)) return;

    loadingRef.current.add(index);
    const img = new Image();
    img.src = getFramePath(index);
    img.onload = () => {
      loadingRef.current.delete(index);
      frameCacheRef.current.set(index, img);
      // Trigger a re-render if this is the frame we currently need
      const targetFrame = getTargetFrame(progressRef.current);
      if (index === targetFrame || index === 1) {
        drawFrame(index);
        if (index === 1) setFirstFrameReady(true);
      }
    };
    img.onerror = () => {
      loadingRef.current.delete(index);
    };
  };

  const getTargetFrame = (p: number): number => {
    if (reducedMotionRef.current) return Math.ceil(TOTAL_FRAMES / 2);
    return Math.max(1, Math.min(TOTAL_FRAMES, Math.round(p * (TOTAL_FRAMES - 1)) + 1));
  };

  const drawFrame = (frameIndex: number): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const img = frameCacheRef.current.get(frameIndex);
    if (!img) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Match canvas pixel dimensions to display dimensions
    const dpr = window.devicePixelRatio || 1;
    const displayW = canvas.clientWidth;
    const displayH = canvas.clientHeight;
    const bufW = Math.round(displayW * dpr);
    const bufH = Math.round(displayH * dpr);

    if (canvas.width !== bufW || canvas.height !== bufH) {
      canvas.width = bufW;
      canvas.height = bufH;
    }

    // Cover-style: fill viewport, preserve aspect ratio, no distortion
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const canvasAspect = bufW / bufH;

    let drawW: number, drawH: number, drawX: number, drawY: number;
    if (imgAspect > canvasAspect) {
      drawH = bufH;
      drawW = bufH * imgAspect;
      drawX = (bufW - drawW) / 2;
      drawY = 0;
    } else {
      drawW = bufW;
      drawH = bufW / imgAspect;
      drawX = 0;
      drawY = (bufH - drawH) / 2;
    }

    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    currentFrameRef.current = frameIndex;
  };

  const preloadBatch = (center: number, radius = 8): void => {
    const start = Math.max(1, center - radius);
    const end = Math.min(TOTAL_FRAMES, center + radius);
    for (let i = start; i <= end; i++) {
      loadFrame(i);
    }
  };

  // ─── Animation loop ────────────────────────────────────────────────────────

  const scheduleRender = (): void => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const targetFrame = getTargetFrame(progressRef.current);

      if (frameCacheRef.current.has(targetFrame)) {
        if (currentFrameRef.current !== targetFrame) {
          drawFrame(targetFrame);
        }
      } else {
        // Frame not loaded yet — try to show nearest available frame
        let nearest = -1;
        for (let r = 1; r <= 10; r++) {
          if (frameCacheRef.current.has(targetFrame - r)) { nearest = targetFrame - r; break; }
          if (frameCacheRef.current.has(targetFrame + r)) { nearest = targetFrame + r; break; }
        }
        if (nearest !== -1 && currentFrameRef.current !== nearest) {
          drawFrame(nearest);
        }
        // Keep trying until the frame arrives (handled by img.onload → drawFrame)
      }

      preloadBatch(targetFrame);
    });
  };

  // ─── Trigger render on progress change ────────────────────────────────────
  useEffect(() => {
    scheduleRender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, reducedMotion]);

  // ─── Initial setup: preload first frame immediately ────────────────────────
  useEffect(() => {
    // Load first frame right away so there's no blank on mount
    loadFrame(1);
    // Preload frames 1–20 eagerly
    for (let i = 1; i <= 20; i++) loadFrame(i);

    // Handle window resize — re-draw current frame at new size
    const handleResize = () => {
      const target = getTargetFrame(progressRef.current);
      const frameToRedraw = frameCacheRef.current.has(target)
        ? target
        : currentFrameRef.current >= 1
        ? currentFrameRef.current
        : -1;
      if (frameToRedraw >= 1) {
        currentFrameRef.current = -1; // force redraw
        drawFrame(frameToRedraw);
      }
    };

    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      window.removeEventListener('resize', handleResize);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        display: 'block',
        pointerEvents: 'none',
        // Subtle darkening overlay so text stays legible
        // Applied via CSS filter for simplicity; can be tuned
        opacity: firstFrameReady ? 0.85 : 0,
        transition: 'opacity 0.4s ease',
      }}
    />
  );
}

// ─── useScrollProgress ────────────────────────────────────────────────────────

/**
 * Returns scroll progress as a value in [0, 1].
 * totalScrollHeight: the intended total scrollable height (px).
 */
export function useScrollProgress(totalScrollHeight: number): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const maxScroll = Math.max(1, totalScrollHeight - window.innerHeight);
        const p = scrollTop / maxScroll;
        setProgress(Math.max(0, Math.min(1, p)));
        ticking = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // compute initial value

    return () => window.removeEventListener('scroll', onScroll);
  }, [totalScrollHeight]);

  return progress;
}

// ─── useReducedMotion ─────────────────────────────────────────────────────────

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return reduced;
}