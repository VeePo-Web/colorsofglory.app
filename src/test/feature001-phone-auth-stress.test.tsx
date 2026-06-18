import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PhoneLoginPage from "@/pages/auth/PhoneLoginPage";
import CodeVerifyPage from "@/pages/auth/CodeVerifyPage";
import InviteVerifyPage from "@/pages/invite/InviteVerifyPage";

const supabaseMocks = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  from: vi.fn(),
}));

const inviteApiMocks = vi.hoisted(() => ({
  acceptInvite: vi.fn(),
  updateOnboardingStep: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithOtp: supabaseMocks.signInWithOtp,
      verifyOtp: supabaseMocks.verifyOtp,
    },
    from: supabaseMocks.from,
  },
}));

vi.mock("@/lib/invite/inviteApi", () => ({
  acceptInvite: inviteApiMocks.acceptInvite,
  updateOnboardingStep: inviteApiMocks.updateOnboardingStep,
}));

const renderPhoneFlow = (path = "/auth/phone") =>
  render(
    <MemoryRouter initialEntries={[path]} future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <Routes>
        <Route path="/auth/login" element={<p>email-route</p>} />
        <Route path="/auth/phone" element={<PhoneLoginPage />} />
        <Route path="/auth/phone/verify" element={<CodeVerifyPage />} />
        <Route path="/onboarding/intent" element={<p>onboarding-route</p>} />
      </Routes>
    </MemoryRouter>,
  );

const renderInviteVerify = () =>
  render(
    <MemoryRouter initialEntries={["/invite/verify"]} future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <Routes>
        <Route path="/invite/demo" element={<p>invite-demo-route</p>} />
        <Route path="/invite/verify" element={<InviteVerifyPage />} />
        <Route path="/invite/name" element={<p>invite-name-route</p>} />
      </Routes>
    </MemoryRouter>,
  );

const typePhone = (value: string) => {
  fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value } });
};

describe("Feature 001 phone auth Twilio/SMS UX stress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    supabaseMocks.from.mockReturnValue({
      select: () => ({
        limit: () => Promise.resolve({ data: [], error: null }),
      }),
    });
    inviteApiMocks.acceptInvite.mockResolvedValue({ status: "success", songId: "song-1", songTitle: "Great Is Your Name", role: "contributor" });
    inviteApiMocks.updateOnboardingStep.mockResolvedValue(undefined);
  });

  it("keeps every phone input description id attached to a real element", () => {
    renderPhoneFlow();

    const input = screen.getByLabelText(/phone number/i);
    const describedBy = input.getAttribute("aria-describedby")?.split(/\s+/).filter(Boolean) ?? [];

    expect(describedBy).toContain("phone-hint");
    for (const id of describedBy) {
      expect(document.getElementById(id)).not.toBeNull();
    }
  });

  it("sets up the Twilio/Supabase OTP request without firing until the number is valid", async () => {
    supabaseMocks.signInWithOtp.mockResolvedValue({ error: null });
    renderPhoneFlow();

    const continueButton = screen.getByRole("button", { name: /continue/i });
    expect(continueButton).toBeDisabled();

    typePhone("abc 555-555-1212 ext 999");

    expect(screen.getByLabelText(/phone number/i)).toHaveValue("(555) 555-1212");
    expect(continueButton).toBeEnabled();

    fireEvent.click(continueButton);

    await waitFor(() => {
      expect(supabaseMocks.signInWithOtp).toHaveBeenCalledWith({ phone: "+15555551212" });
      expect(screen.getByRole("heading", { name: /check your phone/i })).toBeInTheDocument();
    });
    expect(sessionStorage.getItem("cog:phone-e164")).toBe("+15555551212");
    expect(sessionStorage.getItem("cog:phone-display")).toBe("(555) 555-1212");
  });

  it.each([
    [{ code: "phone_provider_disabled", message: "Unsupported phone provider" }, /sms sign-in isn't available/i],
    [{ code: "over_sms_send_rate_limit", message: "rate limit" }, /too many attempts/i],
    [{ code: "bad_phone", message: "invalid phone" }, /valid us phone number/i],
    [new Error("network failed"), /check your connection/i],
  ])("keeps the typed number and shows calm copy when SMS send fails: %o", async (error, copy) => {
    supabaseMocks.signInWithOtp.mockResolvedValue({ error });
    renderPhoneFlow();

    typePhone("5555551212");
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(await screen.findByText(copy)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone number/i)).toHaveValue("(555) 555-1212");
    expect(sessionStorage.getItem("cog:phone-e164")).toBeNull();
  });

  it("submits a pasted OTP code to Supabase verify and clears boxes on a Twilio/Supabase rejection", async () => {
    sessionStorage.setItem("cog:phone-e164", "+15555551212");
    sessionStorage.setItem("cog:phone-display", "(555) 555-1212");
    supabaseMocks.verifyOtp.mockResolvedValue({
      error: { message: "Invalid token" },
      data: { session: null },
    });
    renderPhoneFlow("/auth/phone/verify");

    fireEvent.paste(screen.getByLabelText(/code digit 1/i), {
      clipboardData: { getData: () => "123456" },
    });

    await waitFor(() => {
      expect(supabaseMocks.verifyOtp).toHaveBeenCalledWith({
        phone: "+15555551212",
        token: "123456",
        type: "sms",
      });
      expect(screen.getByText(/that code didn't work/i)).toBeInTheDocument();
    });
    for (const input of screen.getAllByLabelText(/code digit/i)) {
      expect(input).toHaveValue("");
    }
  });

  it("keeps invite OTP rejection copy calm when Supabase returns a plain error object", async () => {
    sessionStorage.setItem("cog:phone-e164", "+15555551212");
    sessionStorage.setItem("cog:phone-display", "(555) 555-1212");
    sessionStorage.setItem(
      "cog:invite-context",
      JSON.stringify({
        token: "invite-token",
        songTitle: "Great Is Your Name",
      }),
    );
    supabaseMocks.verifyOtp.mockResolvedValue({
      error: { message: "Invalid token" },
      data: { session: null },
    });
    renderInviteVerify();

    fireEvent.paste(screen.getByLabelText(/code digit 1/i), {
      clipboardData: { getData: () => "123456" },
    });

    await waitFor(() => {
      expect(supabaseMocks.verifyOtp).toHaveBeenCalledWith({
        phone: "+15555551212",
        token: "123456",
        type: "sms",
      });
      expect(screen.getByText(/that code didn't work/i)).toBeInTheDocument();
    });
    expect(inviteApiMocks.acceptInvite).not.toHaveBeenCalled();
  });
});
