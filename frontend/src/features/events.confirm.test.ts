import { describe, it, expect, beforeEach } from "vitest";
import { requestConfirm } from "./events";

describe("requestConfirm", () => {
  beforeEach(() => {
    document.getElementById("confirmModalRoot")?.remove();
  });

  it("OK → true", async () => {
    const p = requestConfirm("Удалить?");
    const root = document.getElementById("confirmModalRoot");
    expect(root).toBeTruthy();
    (root!.querySelector("#confirmModalOk") as HTMLButtonElement).click();
    await expect(p).resolves.toBe(true);
  });

  it("Отмена → false", async () => {
    const p = requestConfirm("Удалить?");
    const root = document.getElementById("confirmModalRoot");
    (root!.querySelector("#confirmModalCancel") as HTMLButtonElement).click();
    await expect(p).resolves.toBe(false);
  });
});
