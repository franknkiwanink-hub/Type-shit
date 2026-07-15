import StaticPage, { StaticSection } from "@/components/layout/StaticPage";

// No contact-form backend exists yet (no /api route for it), so this
// intentionally stays a plain contact-info page rather than a form that
// silently goes nowhere — same "don't fake functionality" approach the
// rest of the port uses (e.g. NavDrawer's toast for unbuilt features).
// A real form can replace this once a submission endpoint exists.
export default function ContactPage() {
  return (
    <StaticPage
      eyebrow="Contact Us"
      title="Get in touch"
      intro="Have a question about a listing, a deal, or your account? Here's how to reach us."
    >
      <StaticSection heading="General support">
        <p>
          Email <strong style={{ color: "var(--mp-text)" }}>support@siterifty.com</strong> for
          account issues, billing questions, or anything else. We aim to respond within 24–48
          hours.
        </p>
      </StaticSection>

      <StaticSection heading="Active deal or dispute">
        <p>
          If your question is about a specific deal, the fastest way to get help is from inside
          that deal&apos;s chat — messages there are tied to the transaction, which lets support
          see the full context immediately. For disputes already raised through escrow, our team
          reviews and responds within 24–48 hours of the dispute being opened.
        </p>
      </StaticSection>

      <StaticSection heading="Reporting a listing or seller">
        <p>
          You can report a listing or seller directly from their profile page. Reports go to our
          review team and aren&apos;t visible to the seller.
        </p>
      </StaticSection>
    </StaticPage>
  );
}
