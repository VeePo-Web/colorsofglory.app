import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

/**
 * Handles the /r/:code referral short-link.
 * Saves the referral code to sessionStorage and redirects to the upgrade page
 * with ?ref=:code so the pricing page shows referred pricing.
 *
 * Example: colorsofglory.app/r/PARKER123 redirects to /upgrade?ref=PARKER123
 */
const ReferralRedirectPage = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (code) {
      const normalized = code.trim().toUpperCase();
      // Persist so checkout survives page refreshes
      sessionStorage.setItem("cog:referral-code", normalized);
    }
    navigate(`/upgrade?ref=${code ?? ""}`, { replace: true });
  }, [code, navigate]);

  return null; // Instant redirect - no flash
};

export default ReferralRedirectPage;
