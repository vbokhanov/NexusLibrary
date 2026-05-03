import { describe, it, expect } from "vitest";
import { setupCounter } from "./counter";

describe("setupCounter", () => {
  it("увеличивает счётчик по клику", () => {
    document.body.innerHTML = "";
    const btn = document.createElement("button");
    document.body.appendChild(btn);
    setupCounter(btn);
    expect(btn.textContent).toContain("0");
    btn.click();
    expect(btn.textContent).toContain("1");
  });
});
