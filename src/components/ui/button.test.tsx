import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "./button";

describe("Button", () => {
  it("renders its children", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("while pending, keeps its label (and width) but blocks presses and says it's busy", () => {
    render(<Button pending>Finish workout</Button>);
    const button = screen.getByRole("button", { name: "Finish workout" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button.querySelector(".animate-spin")).not.toBeNull();
    // Full strength while working — not the dimmed "unavailable" look.
    expect(button.className).toContain("disabled:opacity-100");
    expect(button.className).not.toContain("disabled:opacity-50");
  });

  it("renders as a child element with asChild", () => {
    render(
      <Button asChild>
        <a href="/somewhere">Link button</a>
      </Button>,
    );
    expect(screen.getByRole("link", { name: "Link button" })).toHaveAttribute(
      "href",
      "/somewhere",
    );
  });
});
