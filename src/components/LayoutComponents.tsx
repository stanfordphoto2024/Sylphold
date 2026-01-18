import { ReactNode } from "react";
import { useState, useEffect } from "react";

export function useSystemClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  return {
    date: dateFormatter.format(now),
    time: timeFormatter.format(now),
  };
}

export function SystemClock() {
  const { date, time } = useSystemClock();

  return (
    <div className="flex flex-col items-center justify-center text-xs sm:text-sm text-slate-100/80 tracking-[0.2em] uppercase">
      <span className="font-medium">{time}</span>
      <span className="text-[0.6rem] sm:text-[0.65rem] text-slate-400 tracking-[0.3em]">
        {date}
      </span>
    </div>
  );
}

export function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="h-9 w-9 rounded-2xl bg-muted-coral/15 border border-muted-coral/70 flex items-center justify-center text-muted-coral text-lg font-semibold shadow-[0_0_24px_rgba(255,127,80,0.55)]">
        S
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-xs sm:text-sm font-semibold tracking-[0.35em] text-muted-coral">
          SYLPHOLD
        </span>
        <span className="text-[0.6rem] sm:text-[0.7rem] text-slate-300/80 tracking-[0.22em]">
          REALTIME SYSTEM CONSOLE
        </span>
      </div>
    </div>
  );
}

export function GlassPanel(props: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-white/5 border border-white/10 shadow-glass backdrop-blur-2xl">
      <div className="absolute inset-0 pointer-events-none opacity-60 mix-blend-screen bg-[radial-gradient(circle_at_0%_0%,rgba(255,127,80,0.22),transparent_45%),radial-gradient(circle_at_100%_100%,rgba(56,189,248,0.16),transparent_45%)]" />
      <div className="relative px-5 sm:px-7 pt-4 pb-4 sm:pb-5 flex flex-col gap-3">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xs sm:text-sm font-semibold tracking-[0.25em] text-slate-100 uppercase">
              {props.title}
            </h2>
            {props.subtitle ? (
              <p className="mt-1 text-[0.65rem] sm:text-xs text-slate-400 tracking-[0.16em] uppercase">
                {props.subtitle}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5 text-[0.55rem] sm:text-[0.6rem] text-slate-400 tracking-[0.22em]">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.9)]" />
            <span>LIVE</span>
          </div>
        </header>
        {props.children ? (
          <div className="mt-1 text-[0.7rem] sm:text-xs text-slate-200/90">{props.children}</div>
        ) : null}
      </div>
    </section>
  );
}
