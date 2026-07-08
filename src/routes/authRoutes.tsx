import { lazy } from "react";
import { Route, Navigate, useParams } from "react-router-dom";
import RequireAuth from "@/components/auth/RequireAuth";

// ── Auth, invite/join, returning-home routing ─────────────────────────────
// Public front door (phone-first Twilio SMS OTP; email is the fallback), the
// frictionless invite/join flow, and the returning-user smart home. Add auth or
// invite screens HERE, not in App.tsx.

const PhoneLoginPage = lazy(() => import("@/pages/auth/PhoneLoginPage"));
const CodeVerifyPage = lazy(() => import("@/pages/auth/CodeVerifyPage"));
const EmailAuthPage = lazy(() => import("@/pages/auth/EmailAuthPage"));
const EmailCodeVerifyPage = lazy(() => import("@/pages/auth/EmailCodeVerifyPage"));
const ResetPasswordPage = lazy(() => import("@/pages/auth/ResetPasswordPage"));
const ForgotPasswordPage = lazy(() => import("@/pages/auth/ForgotPasswordPage"));

// Legacy /invite/:token links (and the post-auth pending-invite resume) funnel
// into the one real, frictionless join flow at /join/:token. The old preview
// page was a mock that dumped users onto the wrong song — never route to it.
const InviteTokenRedirect = () => {
  const { token } = useParams<{ token: string }>();
  return <Navigate to={`/join/${token ?? ""}`} replace />;
};

const JoinEntryPage = lazy(() => import("@/pages/invite/JoinEntryPage"));
const InviteJoinPage = lazy(() => import("@/pages/invite/InviteJoinPage"));
const InviteWelcomePage = lazy(() => import("@/pages/invite/InviteWelcomeBackPage"));
const InviteVerifyPage = lazy(() => import("@/pages/invite/InviteVerifyPage"));
const InviteNamePage = lazy(() => import("@/pages/invite/InviteNamePage"));
const InviteTeamPage = lazy(() => import("@/pages/invite/InviteTeamIntroPage"));
const ReturningHomePage = lazy(() => import("@/pages/ReturningHomePage"));

export const authRoutes = (
  <>
    {/* Auth — phone-first front door; email is the fallback */}
    <Route path="/auth" element={<Navigate to="/auth/login" replace />} />
    <Route path="/auth/login" element={<PhoneLoginPage />} />
    <Route path="/auth/phone" element={<Navigate to="/auth/login" replace />} />
    <Route path="/auth/phone/verify" element={<CodeVerifyPage />} />
    <Route path="/auth/email" element={<EmailAuthPage />} />
    <Route path="/auth/email/verify" element={<EmailCodeVerifyPage />} />
    <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/auth/reset" element={<ResetPasswordPage />} />
    <Route path="/auth/reset-password" element={<ResetPasswordPage />} />

    {/* Legacy invite link → redirect into the real frictionless join flow */}
    <Route path="/invite/:token" element={<InviteTokenRedirect />} />

    {/* Frictionless invite join flow: colorsofglory.app/join/:token */}
    <Route path="/join" element={<JoinEntryPage />} />
    <Route path="/join/:token" element={<InviteJoinPage />} />
    <Route path="/invite/welcome" element={<InviteWelcomePage />} />
    <Route path="/invite/verify" element={<InviteVerifyPage />} />
    <Route path="/invite/name" element={<InviteNamePage />} />
    <Route path="/invite/team" element={<InviteTeamPage />} />

    {/* Returning user smart home — requires an authed session */}
    <Route path="/home" element={<RequireAuth><ReturningHomePage /></RequireAuth>} />
  </>
);
