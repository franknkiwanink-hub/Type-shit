// Server-only Admin SDK fetch of a seller's SEO-relevant profile fields.
//
// Deliberately NOT a server port of lib/useSeller.ts's fetchFullSeller —
// that pulls the seller's full listings array, follower count, and a
// second network call for deal stats, all client-side data the page body
// still fetches itself on mount (see page.tsx below). This helper only
// reads what generateMetadata needs: username/bio/rating/plan/visibility
// and a cheap listing count. Keeping it separate avoids duplicating a
// heavier Admin-SDK version of fetchFullSeller that would drift from the
// client one over time.
//
// PRIVACY: profileVisibility gates what generateMetadata is allowed to
// expose to crawlers/link-preview bots, mirroring the same gate the
// client page already enforces for human visitors (see page.tsx's
// "private"/"members" branches). A private profile must never leak its
// real bio, stats, or listing count into a <meta> tag just because a
// crawler doesn't go through the client visibility check.

import { getAdminDb } from "@/lib/server/adminDb";

export interface SellerSeoProfile {
  uid: string;
  username: string;
  bio: string;
  profilePic: string;
  rating: number;
  ratingCount: number;
  plan: string;
  profileVisibility: string;
  showBio: boolean;
  activeListingCount: number;
}

export async function getSellerSeoProfile(uid: string): Promise<SellerSeoProfile | null> {
  if (!uid) return null;
  const db = getAdminDb();
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) return null;
  const d = snap.data() || {};

  // Cheap count-only query — mirrors the `active` status filter used
  // everywhere else (listings/_handler.js's feed query, useSeller.ts's
  // fetchFullSeller) — never fetches the actual listing docs, since
  // metadata only needs a number, not the listings themselves.
  let activeListingCount = 0;
  try {
    const countSnap = await db
      .collection("listings")
      .where("ownerId", "==", uid)
      .where("status", "==", "active")
      .count()
      .get();
    activeListingCount = countSnap.data().count;
  } catch (err) {
    console.error("[getSellerSeoProfile] listing count failed for", uid, err);
  }

  return {
    uid,
    username: d.username || d.displayName || d.email?.split("@")[0] || "Anonymous",
    bio: d.bio || "",
    profilePic: d.profilePic || "",
    rating: typeof d.rating === "number" ? d.rating : 0,
    ratingCount: typeof d.ratingCount === "number" ? d.ratingCount : 0,
    plan: d.plan || "free",
    profileVisibility: d.profileVisibility || "public",
    showBio: d.showBio !== false,
    activeListingCount,
  };
}
