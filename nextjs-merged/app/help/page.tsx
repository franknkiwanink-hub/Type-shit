import StaticPage, { StaticSection, FaqItem } from "@/components/layout/StaticPage";

export default function HelpPage() {
  return (
    <StaticPage
      eyebrow="Help Center"
      title="Frequently asked questions"
      intro="Answers to the questions we get most about buying, selling, and how escrow works."
    >
      <StaticSection heading="Buying">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <FaqItem q="How do I buy something on Siterifty?">
            Message the seller from a listing to open a deal. Once they accept, you fund escrow
            from your wallet — the money is held by Siterifty, not sent to the seller yet. The
            seller then delivers the site, app, or game files through the deal chat, and you have
            72 hours to confirm you received everything before funds release automatically.
          </FaqItem>
          <FaqItem q="What if what I received doesn't match the listing?">
            Raise a dispute from the deal chat before the 72-hour window ends. This freezes the
            escrow immediately so funds can&apos;t release to either side, and our team reviews
            the case within 24–48 hours.
          </FaqItem>
          <FaqItem q="How do I pay?">
            All payments run through your Siterifty wallet. Top up your wallet with a card or
            PayPal from Settings → Payment Methods, then pay for deals directly from that balance.
          </FaqItem>
        </div>
      </StaticSection>

      <StaticSection heading="Selling">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <FaqItem q="What does Siterifty take as a fee?">
            A percentage of the sale price, deducted when funds release to your wallet. The rate
            depends on your plan: 30% on the free plan, 20% on Starter, 10% on Growth, and 5% on
            Pro. Upgrading only affects future sales, not deals already in progress.
          </FaqItem>
          <FaqItem q="How many listings can I have live at once?">
            Weekly listing quotas scale with your plan — 5 a week on Free, 15 on Starter, 30 on
            Growth, and unlimited on Pro.
          </FaqItem>
          <FaqItem q="When do I actually get paid?">
            After you mark a deal delivered, the buyer has 72 hours to confirm. Funds release to
            your wallet either when they confirm or automatically once the 72 hours pass, minus
            the platform fee for your plan.
          </FaqItem>
        </div>
      </StaticSection>

      <StaticSection heading="Account">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <FaqItem q="How do I change my plan?">
            Go to Settings → Billing & Plans to upgrade, downgrade, or manage your current
            subscription.
          </FaqItem>
          <FaqItem q="I think my account was wrongly restricted — what do I do?">
            Settings → Danger Zone has an appeal option for restricted accounts. Submit it there
            and our team will review.
          </FaqItem>
        </div>
      </StaticSection>

      <StaticSection heading="Still stuck?">
        <p>
          Reach out any time — see the Contact Us page for the fastest way to get a real answer.
        </p>
      </StaticSection>
    </StaticPage>
  );
}
