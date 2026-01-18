import { useState } from "react";

export function MapLegend() {
  const [visible, setVisible] = useState(false);

  return (
    <div
      className="absolute bottom-3 right-4 sm:bottom-4 sm:right-5 z-20 flex flex-col items-end"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <div
        className={`transition-all duration-300 ease-out origin-bottom-right ${
          visible
            ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
            : "opacity-0 translate-y-4 scale-95 pointer-events-none"
        }`}
      >
        <div className="rounded-2xl border border-white/15 bg-slate-900/80 backdrop-blur-xl px-3 py-2.5 sm:px-3.5 sm:py-3 shadow-[0_18px_45px_rgba(15,23,42,0.9)] space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[0.6rem] tracking-[0.22em] uppercase text-slate-200">
              Map Legend
            </span>
            <span className="text-[0.55rem] text-slate-400 tracking-[0.2em] uppercase">
              Origins · Objects
            </span>
          </div>
          <div className="space-y-1.5 text-[0.65rem] text-slate-200/90">
            <div className="flex items-center gap-2">
              <div className="laundry-marker-svg">
                <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M8.5 11L12 7.5 16 9.3 20 7.5 23.5 11 21.5 12.8 20.6 12.2V24H11.4V12.2L8.5 11z"
                    fill="#C4B5FD"
                    stroke="#7C3AED"
                    strokeWidth="1.1"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M12 7.5c0.5 0.7 1.3 1.2 2 1.2s1.5-0.5 2-1.2"
                    fill="none"
                    stroke="#4C1D95"
                    strokeWidth="0.9"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <span className="flex-1">Laundry hub</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="house-marker-svg">
                <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                  <polygon points="6,16 16,6 26,16 26,26 6,26" fill="#020617" />
                  <polygon points="8,16 16,8 24,16 24,24 8,24" fill="#FBBF24" />
                  <rect x="14" y="18" width="4" height="6" fill="#020617" />
                </svg>
              </div>
              <span className="flex-1">Customer</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="helper-marker-svg">
                <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="16" cy="11" r="4" fill="#22C55E" />
                  <path d="M10 24c0-3.3 2.7-6 6-6s6 2.7 6 6" fill="#22C55E" />
                  <path
                    d="M10 24c0-3.3 2.7-6 6-6s6 2.7 6 6"
                    fill="none"
                    stroke="#111827"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <span className="flex-1">Helper pickup node</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="vehicle-marker-svg">
                <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                  <rect x="10" y="6" width="12" height="20" rx="3" fill="#3B82F6" />
                  <rect x="11" y="10" width="10" height="8" rx="2" fill="#E5E7EB" />
                  <circle cx="11" cy="9" r="2" fill="#F9FAFB" />
                  <circle cx="21" cy="9" r="2" fill="#F9FAFB" />
                  <circle cx="11" cy="23" r="2" fill="#F9FAFB" />
                  <circle cx="21" cy="23" r="2" fill="#F9FAFB" />
                </svg>
              </div>
              <span className="flex-1">Vehicle position</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="h-[3px] w-6 rounded-full"
                style={{
                  backgroundColor: "#38BDF8",
                  boxShadow: "0 0 14px rgba(56,189,248,0.9)",
                }}
              />
              <span className="flex-1">Inbound to laundry hub</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="h-[3px] w-6 rounded-full"
                style={{
                  backgroundColor: "#F97316",
                  boxShadow: "0 0 14px rgba(249,115,22,0.9)",
                }}
              />
              <span className="flex-1">Return to customer</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="incident-dot-legend" />
              <span className="flex-1">
                Flashing red: Vehicle crash / malfunction
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="h-[3px] w-6 rounded-full"
                style={{
                  backgroundColor: "#A855F7",
                  boxShadow: "0 0 14px rgba(168,85,247,0.9)",
                }}
              />
              <span className="flex-1">Purple solid line: Relay / rescue route</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="handover-zone-legend" />
              <span className="flex-1">Blue glow ring: Handover zone</span>
            </div>
          </div>
        </div>
      </div>

      {/* Trigger Area - Invisible but hoverable */}
      <div
        className={`absolute -bottom-4 -right-5 w-24 h-24 bg-transparent z-10 ${
          visible ? "pointer-events-none" : "pointer-events-auto"
        }`}
        aria-hidden="true"
      />
    </div>
  );
}
