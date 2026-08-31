"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Pause, Play, RotateCcw, Timer, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/training";
import { Button } from "@/components/ui/button";

const PRESETS = [60, 90, 120, 180];
const REST_KEY = "progfrog.restSeconds";

/** Fired by per-exercise "Rest" buttons: `window.dispatchEvent(restEvent(secs))`. */
export function restEvent(seconds: number) {
  return new CustomEvent("progfrog:rest", { detail: seconds });
}

export function getDefaultRest(): number {
  if (typeof window === "undefined") return 120;
  const v = Number(window.localStorage.getItem(REST_KEY));
  return Number.isFinite(v) && v > 0 ? v : 120;
}

/**
 * Rest timer. Lives in the dashboard layout so it keeps running across route
 * changes; visible on logger pages or whenever it's counting down.
 */
export function RestTimer() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [target, setTarget] = React.useState(120);
  const [remaining, setRemaining] = React.useState<number | null>(null);
  const [paused, setPaused] = React.useState(false);
  const audioRef = React.useRef<AudioContext | null>(null);

  const running = remaining !== null;
  const onLoggerPage =
    pathname.startsWith("/dashboard/workouts/") && !pathname.endsWith("/new");

  const alarm = React.useCallback(() => {
    try {
      navigator.vibrate?.([200, 100, 200, 100, 300]);
    } catch {
      /* not supported */
    }
    const ctx = audioRef.current;
    if (!ctx) return;
    const beep = (at: number, freq: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.001, at);
      gain.gain.exponentialRampToValueAtTime(0.3, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.25);
      osc.start(at);
      osc.stop(at + 0.26);
    };
    const now = ctx.currentTime;
    beep(now, 880);
    beep(now + 0.3, 880);
    beep(now + 0.6, 1175);
  }, []);

  const ensureAudio = React.useCallback(() => {
    if (!audioRef.current) {
      try {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        audioRef.current = new Ctor();
      } catch {
        /* no audio */
      }
    }
    void audioRef.current?.resume();
  }, []);

  const start = React.useCallback(
    (seconds: number) => {
      ensureAudio();
      setTarget(seconds);
      setRemaining(seconds);
      setPaused(false);
      setOpen(true);
    },
    [ensureAudio],
  );

  React.useEffect(() => {
    function onRest(e: Event) {
      const detail = (e as CustomEvent<number>).detail;
      start(detail && detail > 0 ? detail : getDefaultRest());
    }
    window.addEventListener("progfrog:rest", onRest);
    return () => window.removeEventListener("progfrog:rest", onRest);
  }, [start]);

  // Tick down once a second.
  React.useEffect(() => {
    if (remaining === null || paused || remaining <= 0) return;
    const id = window.setTimeout(
      () => setRemaining((r) => (r === null ? null : r - 1)),
      1000,
    );
    return () => window.clearTimeout(id);
  }, [remaining, paused]);

  // On hitting zero: alarm, then clear after a beat so "0:00" is visible.
  React.useEffect(() => {
    if (remaining !== 0) return;
    alarm();
    const id = window.setTimeout(() => setRemaining(null), 900);
    return () => window.clearTimeout(id);
  }, [remaining, alarm]);

  if (!onLoggerPage && !running) return null;

  return (
    <div className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-40 md:bottom-6">
      {open ? (
        <div className="bg-popover text-popover-foreground ring-foreground/10 w-64 rounded-xl p-3 shadow-xl ring-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Rest timer</span>
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={() => setOpen(false)}
              aria-label="Collapse"
            >
              <X className="size-3.5" />
            </Button>
          </div>

          <div
            className={cn(
              "font-heading my-2 text-center text-4xl font-semibold tabular-nums",
              running && remaining !== null && remaining <= 5 && "text-destructive",
            )}
          >
            {formatDuration(remaining ?? target)}
          </div>

          <div className="flex items-center justify-center gap-1.5">
            {running ? (
              <>
                <Button
                  size="icon-sm"
                  variant="outline"
                  onClick={() => setPaused((p) => !p)}
                  aria-label={paused ? "Resume" : "Pause"}
                >
                  {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
                </Button>
                <Button
                  size="icon-sm"
                  variant="outline"
                  onClick={() => setRemaining((r) => (r === null ? null : r + 15))}
                >
                  +15
                </Button>
                <Button
                  size="icon-sm"
                  variant="outline"
                  onClick={() => setRemaining((r) => Math.max(0, (r ?? 0) - 15))}
                >
                  −15
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => {
                    setRemaining(null);
                    setPaused(false);
                  }}
                  aria-label="Reset"
                >
                  <RotateCcw className="size-4" />
                </Button>
              </>
            ) : (
              <div className="grid w-full grid-cols-4 gap-1.5">
                {PRESETS.map((s) => (
                  <Button key={s} size="sm" variant="outline" onClick={() => start(s)}>
                    {formatDuration(s)}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <Button
          size="icon-lg"
          className="rounded-full shadow-lg"
          onClick={() => setOpen(true)}
          aria-label="Rest timer"
        >
          {running ? (
            <span className="text-xs font-semibold tabular-nums">
              {formatDuration(remaining ?? 0)}
            </span>
          ) : (
            <Timer className="size-5" />
          )}
        </Button>
      )}
    </div>
  );
}
