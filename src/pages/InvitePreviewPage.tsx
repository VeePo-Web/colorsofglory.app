import { Navigate, useParams } from "react-router-dom";

/**
 * Legacy /invite/:token entry — redirect into the real invite flow.
 *
 * The working invite experience lives at /join/:token (InviteJoinPage): it loads
 * the actual invite, collects the phone, and runs the guarded OTP + accept flow.
 * This route used to render a MOCK preview whose "Open song" button hardcoded
 * /songs/1 — dropping every invitee on a fake demo song instead of the song they
 * were invited to. We funnel the legacy URL into the one real flow so both link
 * formats (/invite/:token and /join/:token) work identically.
 */
const InvitePreviewPage = () => {
  const { token } = useParams<{ token: string }>();
  return <Navigate to={token ? `/join/${encodeURIComponent(token)}` : "/join"} replace />;
};

export default InvitePreviewPage;
