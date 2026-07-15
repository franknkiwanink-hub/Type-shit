"use client";

// Replaces the old modal-based #listModal type-picker + #listingFormModal /
// #listingFormModalGame / #listingFormModalApp with real routes: this page
// is the type picker, and each form lives in its own component. Website
// and Game are wired up; App is next — see port-status.md.
//
// The old picker also showed a weekly-listing-limit bar and plan
// upgrade cards (lmPlansRow) before letting you into a form. That's tied
// to plans-boost.js/wallet.js pricing display, which is a separate piece
// of work — not ported here, so there's currently no client-side cap
// warning before you start a listing (the server still enforces the cap
// on submit, via handleCreate's _checkWeeklyCap).

import { useState } from "react";
import WebsiteListingForm from "@/components/listing/WebsiteListingForm";
import GameListingForm from "@/components/listing/GameListingForm";

type ListingKind = "website" | "app" | "game" | null;

export default function SellPage() {
  const [kind, setKind] = useState<ListingKind>(null);

  if (kind === "website") return <WebsiteListingForm />;
  if (kind === "game") return <GameListingForm />;

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#fff", paddingTop: 92, paddingBottom: 80 }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 20px" }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 8 }}>
          What are you listing?
        </h1>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", marginBottom: 32 }}>
          Choose a type to get started.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          <TypeCard
            label="Website"
            desc="A live site, SaaS, or online business."
            accent="#a3e635"
            icon={<GlobeIcon />}
            onClick={() => setKind("website")}
          />
          <TypeCard
            label="App"
            desc="A mobile or web app."
            accent="#fbbf24"
            icon={<AppIcon />}
            comingSoon
          />
          <TypeCard
            label="Game"
            desc="A browser game or downloadable build."
            accent="#f59e0b"
            icon={<GameIcon />}
            onClick={() => setKind("game")}
          />
        </div>
      </div>
    </div>
  );
}

function TypeCard({
  label,
  desc,
  accent,
  icon,
  onClick,
  comingSoon,
}: {
  label: string;
  desc: string;
  accent: string;
  icon: React.ReactNode;
  onClick?: () => void;
  comingSoon?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={comingSoon}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 10,
        padding: 20,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        cursor: comingSoon ? "not-allowed" : "pointer",
        textAlign: "left",
        fontFamily: "inherit",
        opacity: comingSoon ? 0.5 : 1,
        transition: "border-color 0.2s",
      }}
    >
      <span style={{ width: 36, height: 36, color: accent, display: "flex" }}>{icon}</span>
      <span style={{ fontSize: 17, fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>{desc}</span>
      {comingSoon && (
        <span
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            fontSize: 10,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "rgba(255,255,255,0.4)",
            background: "rgba(255,255,255,0.08)",
            padding: "3px 8px",
            borderRadius: 20,
          }}
        >
          Coming soon
        </span>
      )}
    </button>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ width: "100%", height: "100%" }}>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" />
    </svg>
  );
}
function AppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ width: "100%", height: "100%" }}>
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  );
}
function GameIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ width: "100%", height: "100%" }}>
      <rect x="2" y="6" width="20" height="12" rx="6" />
      <line x1="7" y1="12" x2="9" y2="12" />
      <line x1="8" y1="11" x2="8" y2="13" />
      <circle cx="16" cy="10.5" r="0.8" fill="currentColor" />
      <circle cx="18" cy="13" r="0.8" fill="currentColor" />
    </svg>
  );
}
