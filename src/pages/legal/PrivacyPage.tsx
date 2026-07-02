import LegalLayout, { LegalSection } from "./LegalLayout";

/**
 * Privacy Policy — plain language, no legalese walls.
 * Linked from the auth + invite screens ("By continuing you agree…").
 */
const PrivacyPage = () => (
  <LegalLayout title="Privacy Policy" updated="June 2026">
    <LegalSection heading="What we collect">
      Your phone number or email (to sign you in), your name (so collaborators
      know who you are), and the songs, voice memos, lyrics, and notes you
      create. If you subscribe, payments are handled by Stripe — we never see
      or store your card number.
    </LegalSection>

    <LegalSection heading="What we never do">
      We don't sell your data. We don't read your songs for advertising. We
      don't share your work with anyone except the collaborators you invite
      into it.
    </LegalSection>

    <LegalSection heading="Text messages">
      When you sign in by phone, we send a one-time code by SMS (delivered
      through Twilio). We only text you sign-in codes — no marketing texts.
      Message and data rates may apply.
    </LegalSection>

    <LegalSection heading="Email">
      We send account emails (sign-in, confirmations, invites you request).
      Anything beyond that is optional and has an unsubscribe link.
    </LegalSection>

    <LegalSection heading="Who can see your work">
      Only you and the people you've invited into a song can see that song.
      Referral activity shows anonymized signals (that someone joined — not
      who) to the person whose link they used.
    </LegalSection>

    <LegalSection heading="How it's protected">
      Your work is stored encrypted in transit and at rest with our
      infrastructure provider (Supabase). Access is controlled per song, per
      role, and enforced on the server.
    </LegalSection>

    <LegalSection heading="Your choices">
      You can export your work, change your details, or delete your account.
      Deleting your account removes your personal data; songs you co-wrote
      keep the contributions and credits your collaborators depend on.
    </LegalSection>

    <LegalSection heading="Questions">
      Reach us anytime at <a href="mailto:people@colorsofglory.com">people@colorsofglory.com</a>.
    </LegalSection>
  </LegalLayout>
);

export default PrivacyPage;
