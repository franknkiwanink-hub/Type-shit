import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import Header from "@/components/layout/Header";
import NavDrawer from "@/components/layout/NavDrawer";
import NavDrawerOverlay from "@/components/layout/NavDrawerOverlay";
import { NavDrawerProvider } from "@/components/layout/NavDrawerProvider";
import BottomNav from "@/components/layout/BottomNav";
import AnnouncementBar from "@/components/layout/AnnouncementBar";
import BootOverlay from "@/components/layout/BootOverlay";
import PushServiceWorkerRegister from "@/components/layout/PushServiceWorkerRegister";
import { AuthProvider } from "@/lib/AuthContext";
import { AuthModalProvider } from "@/components/auth/AuthModalProvider";
import { WalletModalProvider } from "@/components/wallet/WalletModalProvider";
import { PlansModalProvider } from "@/components/billing/PlansModalProvider";
import { ThemeModalProvider } from "@/components/theme/ThemeModalProvider";
import NotificationsProvider from "@/components/notifications/NotificationsProvider";
import SystemStatusProvider from "@/components/system/SystemStatusProvider";
import WelcomeBackScreen from "@/components/system/WelcomeBackScreen";
import FeedbackWidget from "@/components/support/FeedbackWidget";

export const metadata: Metadata = {
  title: "Siterifty — Buy & Sell Websites, Apps & Games for Indie & Small Developers",
  description:
    "Siterifty is a secure, escrow-protected marketplace built for indie and small developers buying and selling websites, apps, and games. Browse profitable listings or list your own — safe, verified deals from start to finish.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {/* Ports the early FOUC-prevention IIFE from announcement-settings.js
            (index.html lines 162-175) — applies srf_fontSize / srf_compactMode
            from localStorage before paint, so there's no flash of default
            15px/non-compact layout while the rest of the app hydrates and
            useSettingsState's own (Firestore-backed, async, Settings-page-only)
            application catches up. beforeInteractive runs this before React
            hydrates, same timing guarantee the original got from being an
            inline <head> script. */}
        <Script id="srf-early-appearance" strategy="beforeInteractive">
          {`(function(){try{
            var fs=localStorage.getItem('srf_fontSize');
            if(fs){var px={small:'13px',medium:'15px',large:'17px'}[fs]||'15px';
              document.documentElement.style.setProperty('--app-font-size',px);
              document.body.style.fontSize=px;}
            var cm=localStorage.getItem('srf_compactMode');
            if(cm==='1')document.body.classList.add('compact-mode');
          }catch(e){}})();`}
        </Script>
        {/* Ports #appThemeBg from index.html — the full-viewport backdrop
            layer that __applyTheme's CSS custom properties
            (--app-theme-bg / --app-theme-color / --app-theme-overlay)
            paint into. Sits outside every provider since it's pure CSS,
            no state needed here. */}
        <div id="appThemeBg" aria-hidden="true" />
        <PushServiceWorkerRegister />
        <AuthProvider>
          {/* Boot overlay — first thing rendered, removed only after auth
              resolves once + a cooldown, same comment/positioning as the
              original's index.html. */}
          <BootOverlay />
          {/* Maintenance-mode takeover + banned/suspended account
              overlay — both are full-screen, no-dismiss states that
              should render above everything else, same tier as
              BootOverlay. Must be inside AuthProvider (reads
              useAuth()) but works correctly for signed-out visitors
              too, since useAuth() resolves to null rather than
              throwing when nobody's signed in. */}
          <SystemStatusProvider />
          {/* Welcome Back — full-screen daily-objectives takeover shown
              once per sign-in to returning users (account created before
              today), right after the boot splash's own hold. Same tier
              as the overlays above; renders null until it decides to
              open, so it's safe to mount unconditionally here. */}
          <WelcomeBackScreen />
          {/* Global notification toasts + "missed while away" panel —
              needs to be inside AuthProvider (reads useAuth()) but has
              no particular nesting requirement relative to the other
              modal providers below, since it doesn't call any of their
              hooks. */}
          <NotificationsProvider />
          {/* ThemeModalProvider wraps AuthModalProvider (rather than
              nesting inside it, like Wallet/Plans do) because
              AuthModalProvider's tour-finish handler calls
              useThemeModal() itself — it needs to be a descendant of
              ThemeModalProvider's context, not a sibling/ancestor. */}
          <ThemeModalProvider>
            <AuthModalProvider>
              <WalletModalProvider>
                <PlansModalProvider>
                  <NavDrawerProvider>
                    <Header />
                    <NavDrawerOverlay />
                    <NavDrawer />
                    <AnnouncementBar />
                    <main>{children}</main>
                    <BottomNav />
                    {/* Floating feedback launcher + modal — global,
                        works signed-out (read-only) and signed-in
                        (submit/vote). See its own file for the scoping
                        note on scroll-lock/modal-coordination. */}
                    <FeedbackWidget />
                  </NavDrawerProvider>
                </PlansModalProvider>
              </WalletModalProvider>
            </AuthModalProvider>
          </ThemeModalProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
