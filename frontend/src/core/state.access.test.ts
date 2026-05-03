import { describe, it, expect, beforeEach } from "vitest";
import {
  state,
  getCurrentPath,
  canAccessAdminPanel,
  canEditThisBook,
  canDeleteThisBook,
  canManageCatalog,
  canManageBooks,
  canDeleteBooks,
  ROLE_LABELS
} from "./state";

describe("getCurrentPath и права", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/library");
    state.role = "READER";
    state.userId = 5;
  });

  it("неизвестный путь → /", () => {
    window.history.pushState({}, "", "/nowhere");
    expect(getCurrentPath()).toBe("/");
    expect(ROLE_LABELS.GUEST).toBeTruthy();
  });

  it("/admin при не-админе → /library", () => {
    window.history.pushState({}, "", "/admin");
    state.role = "READER";
    expect(getCurrentPath()).toBe("/library");
  });

  it("/admin при ADMIN → /admin", () => {
    window.history.pushState({}, "", "/admin");
    state.role = "ADMIN";
    expect(getCurrentPath()).toBe("/admin");
  });

  it("canAccessAdminPanel", () => {
    state.role = "ADMIN";
    expect(canAccessAdminPanel()).toBe(true);
    state.role = "READER";
    expect(canAccessAdminPanel()).toBe(false);
  });

  it("canManageCatalog / алиасы", () => {
    state.role = "LIBRARIAN";
    expect(canManageCatalog()).toBe(true);
    expect(canManageBooks()).toBe(true);
    state.role = "READER";
    expect(canManageCatalog()).toBe(false);
    expect(canDeleteBooks()).toBe(false);
  });

  it("canEditThisBook / canDeleteThisBook", () => {
    state.role = "READER";
    state.userId = 10;
    expect(canEditThisBook(null)).toBe(false);
    expect(canEditThisBook({ ownerUserId: 10, id: 1 })).toBe(true);
    expect(canEditThisBook({ ownerUserId: 99, id: 1 })).toBe(false);
    expect(canDeleteThisBook({ ownerUserId: 10, id: 1 })).toBe(true);
    state.role = "LIBRARIAN";
    expect(canEditThisBook({ ownerUserId: null, id: 1 })).toBe(true);
  });
});
