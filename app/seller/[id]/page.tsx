import type { Metadata } from "next";
import { getSellerSeoProfile } from "./getSeller";
import { getPublicBaseUrl } from "@/lib/server/adminDb";
import SellerProfileClient from "./SellerProfileClient";

// NOTE: this route intentionally never calls notFound() for a missing
// seller doc — the old client page rendered an inline "Seller not found"
// message instead of a real 404, and SellerProfileClient still owns that
// check (it re-fetches via fetchFullSeller on mount). generateMetadata
// below independently handles the missing/private cases for crawlers so
// the two don't need to be kept in exact sync.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const seller = await getSellerSeoProfile(id);

  if (!seller) {
    return {
      title: "Seller not found — Siterifty",
      description: "This seller profile may have been removed or the link is incorrect.",
    };
  }

  // PRIVACY GATE — mirrors the exact check SellerProfileClient applies
  // for human visitors (profileVisibility === "private" hides everything
  // but username; "members" also hides from signed-out visitors, but
  // metadata has no concept of a signed-in crawler, so it's treated the
  // same as signed-out here — the safer of the two). Crawlers/link-preview
  // bots never get the real bio, rating, or listing count for a
  // non-public profile — only a generic line, same as what a signed-out
  // stranger sees in the private-profile branch of the client component.
  const isPubliclyDiscoverable = seller.profileVisibility === "public";

  const baseUrl = getPublicBaseUrl();
  const url = `${baseUrl}/seller/${seller.uid}`;

  if (!isPubliclyDiscoverable) {
    const title = `${seller.username} — Siterifty`;
    return {
      title,
      description: "This seller's profile is private.",
      alternates: { canonical: url },
      // No OG image/description beyond the generic line — nothing about
      // a private profile should be more discoverable via a link
      // preview than it is by visiting the page directly signed out.
      openGraph: { title, description: "This seller's profile is private.", url, type: "profile" },
      robots: { index: false, follow: false },
    };
  }

  const title = `${seller.username} — Seller on Siterifty`;
  const bioLine = seller.showBio && seller.bio ? seller.bio.trim() : "";
  const description =
    (bioLine.length > 140 ? bioLine.slice(0, 137) + "…" : bioLine) ||
    `${seller.username} has ${seller.activeListingCount} listing${seller.activeListingCount === 1 ? "" : "s"} for sale on Siterifty.`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "profile",
      images: seller.profilePic ? [{ url: seller.profilePic }] : undefined,
    },
    twitter: {
      card: seller.profilePic ? "summary" : "summary",
      title,
      description,
      images: seller.profilePic ? [seller.profilePic] : undefined,
    },
  };
}

export default async function SellerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SellerProfileClient uid={id} />;
}
