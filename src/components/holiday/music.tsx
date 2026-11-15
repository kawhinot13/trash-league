"use client";

import { useEffect, useRef, useState } from "react";

/**
 * "Sleepmas Eve" plays on every visit, looping, with a mute toggle in the nav.
 * Browsers block sound until the visitor interacts, so if autoplay is refused the song starts
 * on the first tap, click or key press anywhere. The mute choice is remembered.
 * Lives in the nav (root layout), so it keeps playing across page changes.
 */
const KEY = "music:muted";

export function MusicToggle() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const mutedRef = useRef(false);
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let saved = false;
    try {
      saved = localStorage.getItem(KEY) === "1";
    } catch {}
    mutedRef.current = saved;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMuted(saved);
    const a = new Audio("/audio/sleepmas-eve.mp3");
    a.loop = true;
    a.volume = 0.45;
    a.preload = "auto";
    audio.current = a;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);

    const unlock = (e: Event) => {
      // the mute button handles its own clicks
      if ((e.target as HTMLElement | null)?.closest?.("[data-music-toggle]")) return;
      if (!mutedRef.current) void a.play().catch(() => {});
      off();
    };
    const off = () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    if (!saved)
      a.play().catch(() => {
        window.addEventListener("pointerdown", unlock);
        window.addEventListener("keydown", unlock);
      });
    return () => {
      off();
      a.pause();
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      audio.current = null;
    };
  }, []);

  const toggle = () => {
    const a = audio.current;
    const next = !muted;
    mutedRef.current = next;
    setMuted(next);
    try {
      localStorage.setItem(KEY, next ? "1" : "0");
    } catch {}
    if (!a) return;
    if (next) a.pause();
    else void a.play().catch(() => {});
  };

  const on = playing && !muted;
  return (
    <button
      type="button"
      data-music-toggle
      onClick={toggle}
      aria-pressed={!muted}
      aria-label={muted ? "Play the music" : "Mute the music"}
      title={muted ? "Play Sleepmas Eve" : "Mute the music"}
      className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white/8 text-[var(--paper)] transition-[background-color,transform] duration-150 hover:bg-white/14 active:scale-95"
    >
      {muted ? (
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M9 18V6l10-2v12" />
          <circle cx="6.5" cy="18" r="2.5" fill="currentColor" stroke="none" />
          <path d="M3 3l18 18" />
        </svg>
      ) : (
        <span className="flex h-4 items-end gap-[3px]" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`w-[3px] rounded-full bg-[var(--paper)] ${on ? "music-bar" : ""}`}
              style={{ height: on ? undefined : `${[6, 10, 8, 5][i]}px`, animationDelay: `${i * -0.22}s` }}
            />
          ))}
        </span>
      )}
    </button>
  );
}
