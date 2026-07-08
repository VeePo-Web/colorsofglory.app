import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import RolePicker from "@/components/roles/RolePicker";
import RoleBadge from "@/components/roles/RoleBadge";
import MemberRow, { type ManageableMember } from "@/components/roles/MemberRow";

// RoleGate reads the single capability source; drive it directly here.
const mockCaps = vi.fn();
vi.mock("@/lib/permissions", () => ({ useCapabilities: () => mockCaps() }));
import RoleGate from "@/components/roles/RoleGate";

// ─── RolePicker ────────────────────────────────────────────────────────────────

describe("RolePicker (E1)", () => {
  it("renders the invite roles and marks the selection", () => {
    const onChange = vi.fn();
    render(<RolePicker value="contributor" onChange={onChange} />);
    expect(screen.getByText("Viewer")).toBeInTheDocument();
    expect(screen.getByText("Contributor")).toBeInTheDocument();
    expect(screen.getByText("Reviewer")).toBeInTheDocument();
    const contributor = screen.getByRole("radio", { name: /contributor/i });
    expect(contributor).toHaveAttribute("aria-checked", "true");
  });

  it("selects a storable role but never the coming-soon Reviewer", () => {
    const onChange = vi.fn();
    render(<RolePicker value="viewer" onChange={onChange} />);

    fireEvent.click(screen.getByRole("radio", { name: /contributor/i }));
    expect(onChange).toHaveBeenCalledWith("contributor");

    onChange.mockClear();
    const reviewer = screen.getByRole("radio", { name: /reviewer/i });
    expect(reviewer).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(reviewer);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText("Soon")).toBeInTheDocument();
  });
});

// ─── RoleBadge ─────────────────────────────────────────────────────────────────

describe("RoleBadge (E1)", () => {
  it("never leaks the raw DB enum to the UI", () => {
    const { rerender } = render(<RoleBadge role="collaborator" />);
    expect(screen.getByText("Contributor")).toBeInTheDocument();
    expect(screen.queryByText("collaborator")).not.toBeInTheDocument();

    rerender(<RoleBadge role="owner" />);
    expect(screen.getByText("Owner")).toBeInTheDocument();

    rerender(<RoleBadge role="viewer" />);
    expect(screen.getByText("Viewer")).toBeInTheDocument();
  });
});

// ─── MemberRow (owner role-management) ──────────────────────────────────────────

const member = (over: Partial<ManageableMember> = {}): ManageableMember => ({
  userId: "u2",
  firstName: "Sarah",
  lastName: "Miller",
  role: "viewer",
  isOwner: false,
  avatarColor: "#53AB8B",
  avatarInitials: "SM",
  ...over,
});

describe("MemberRow (E1)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows no management control to a non-owner", () => {
    render(
      <MemberRow member={member()} canManage={false} onSetRole={vi.fn()} onRemove={vi.fn()} />,
    );
    expect(screen.queryByRole("button", { name: /manage/i })).not.toBeInTheDocument();
  });

  it("never lets even an owner manage the Owner row (last-owner safety)", () => {
    render(
      <MemberRow
        member={member({ userId: "u1", firstName: "Parker", role: "owner", isOwner: true })}
        canManage
        onSetRole={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /manage/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Owner")).toBeInTheDocument();
  });

  it("promotes a viewer to contributor through A3's onSetRole", async () => {
    const onSetRole = vi.fn().mockResolvedValue(undefined);
    render(<MemberRow member={member()} canManage onSetRole={onSetRole} onRemove={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /manage sarah miller's role/i }));
    fireEvent.click(screen.getByRole("button", { name: /make contributor/i }));

    await waitFor(() => expect(onSetRole).toHaveBeenCalledWith("u2", "collaborator"));
  });

  it("removes a collaborator only after a calm confirm", async () => {
    const onRemove = vi.fn().mockResolvedValue(undefined);
    render(
      <MemberRow member={member({ role: "collaborator" })} canManage onSetRole={vi.fn()} onRemove={onRemove} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /manage sarah miller's role/i }));
    fireEvent.click(screen.getByRole("button", { name: /^remove$/i }));
    // Confirm step — nothing removed yet.
    expect(onRemove).not.toHaveBeenCalled();
    expect(screen.getByText(/remove sarah miller from this song\?/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^remove$/i }));
    await waitFor(() => expect(onRemove).toHaveBeenCalledWith("u2"));
  });
});

// ─── RoleGate (declarative capability gate) ─────────────────────────────────────

describe("RoleGate (E1)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders children when the capability is granted", () => {
    mockCaps.mockReturnValue({ can: (c: string) => c === "edit" });
    render(
      <RoleGate songId="s1" can="edit">
        <button>Edit lyric</button>
      </RoleGate>,
    );
    expect(screen.getByRole("button", { name: /edit lyric/i })).toBeInTheDocument();
  });

  it("shows a calm view-only hint (not the control, not an error) when denied", () => {
    mockCaps.mockReturnValue({ can: () => false });
    render(
      <RoleGate songId="s1" can="edit">
        <button>Edit lyric</button>
      </RoleGate>,
    );
    expect(screen.queryByRole("button", { name: /edit lyric/i })).not.toBeInTheDocument();
    expect(screen.getByText(/view only/i)).toBeInTheDocument();
  });

  it("renders nothing when denied + silent", () => {
    mockCaps.mockReturnValue({ can: () => false });
    const { container } = render(
      <RoleGate songId="s1" can="edit" silent>
        <button>Edit</button>
      </RoleGate>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
