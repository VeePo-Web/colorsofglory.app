import LegalLayout, { LegalSection } from "./LegalLayout";

/**
 * Terms of Service — plain language, songwriter-first.
 * Linked from the auth + invite screens ("By continuing you agree…").
 * The single most important promise for this audience leads: you own your songs.
 */
const TermsPage = () => (
  <LegalLayout title="Terms of Service" updated="June 2026">
    <LegalSection heading="Your songs are yours">
      Everything you create in Colors of Glory — lyrics, melodies, voice memos,
      chord charts, notes — belongs to you and your co-writers. We claim no
      ownership of your songs, ever. We store and process your work only to
      provide the service: syncing it to your devices, sharing it with the
      collaborators you invite, and keeping it safe.
    </LegalSection>

    <LegalSection heading="Your account">
      You sign in with your phone number (we text you a code) or your email
      address. Keep access to your number or inbox — it's how you get back in.
      You're responsible for what happens under your account, so don't share
      your sign-in codes with anyone.
    </LegalSection>

    <LegalSection heading="Collaboration">
      When you invite someone into a song, they can see and (depending on the
      role you give them) contribute to that song. Contributions are remembered
      and credited to the person who made them. Removing a collaborator stops
      their access going forward; it doesn't erase the credit for what they
      already contributed.
    </LegalSection>

    <LegalSection heading="Plans and payments">
      Your first song is free. Paid plans unlock more songs and storage, billed
      through Stripe. You can cancel anytime — your work stays safe and
      readable; you just can't add beyond the free limits. Refunds follow the
      policy shown at checkout.
    </LegalSection>

    <LegalSection heading="Referrals">
      If you share your referral link and someone joins a paid plan, you can
      earn a monthly reward while they stay subscribed. Direct referrals only —
      no multi-level structure. Self-referrals, fake accounts, or abuse of the
      program forfeit rewards.
    </LegalSection>

    <LegalSection heading="Acceptable use">
      Be honest and kind. Don't upload content you don't have the right to use,
      don't attempt to break or abuse the service, and don't use it to harass
      others. We may suspend accounts that do.
    </LegalSection>

    <LegalSection heading="The service">
      We work hard to keep Colors of Glory reliable, but it's provided "as is"
      — we can't promise it will never be interrupted. We may update these
      terms as the product grows; if a change matters, we'll tell you in the
      app before it takes effect.
    </LegalSection>

    <LegalSection heading="Questions">
      Reach us anytime at <a href="mailto:hello@colorsofglory.com">hello@colorsofglory.com</a>.
    </LegalSection>
  </LegalLayout>
);

export default TermsPage;
