import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/AppShell";
import { GatedStep } from "@/components/pages/GatedStep";
import { HomeView } from "@/components/pages/HomeView";
import { DISCLAIMER, RECOVERY_MESSAGE } from "@/lib/copy/approved";
import { TODO_NEEDS_HUMAN_REVIEW } from "@/lib/i18n/placeholder";
import { renderApp } from "@/test/render";

const push = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push }),
}));

describe("app shell", () => {
  it("renders the skip link and the repo disclaimer without the review token", () => {
    renderApp(
      <AppShell>
        <HomeView />
      </AppShell>,
    );

    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute("href", "#main");
    expect(screen.getByRole("heading", { level: 1, name: "Listed prices, before you pay" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.queryByText("Demo data")).not.toBeInTheDocument();
    expect(screen.getByText(DISCLAIMER)).toBeInTheDocument();
    expect(screen.queryByText(TODO_NEEDS_HUMAN_REVIEW)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Scan a prescription" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Type medicine names" })).toBeInTheDocument();
  });

  it("switches language and updates the document language", async () => {
    const user = userEvent.setup();
    renderApp(
      <AppShell>
        <HomeView />
      </AppShell>,
    );

    await user.click(screen.getByRole("button", { name: "हिन्दी" }));
    await waitFor(() => expect(document.documentElement.lang).toBe("hi"));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("भुगतान से पहले, सूचीबद्ध कीमत");
    expect(screen.getByText(DISCLAIMER)).toHaveAttribute("lang", "en");
    expect(screen.queryByText("डेमो डेटा")).not.toBeInTheDocument();
  });

  it("shows the privacy recovery screen when a gated step has no session", () => {
    renderApp(
      <AppShell>
        <GatedStep titleKey="step.review" />
      </AppShell>,
    );
    expect(screen.getByRole("heading", { level: 1, name: RECOVERY_MESSAGE })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Check names" })).not.toBeInTheDocument();
  });
});
