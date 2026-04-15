// @ts-nocheck
import "./style.css";
import { getCurrentPath, state } from "./core/state";
import { bindEvents } from "./features/events";
import { renderLayout, syncReadModal } from "./ui/render";

const app = document.querySelector("#app");
if (!app) throw new Error("App root not found");

function resetReadModalState() {
  state.readModalOpen = false;
  state.readModalBookId = null;
  state.readModalTitle = "";
  state.readModalText = "";
}

function navigate(path) {
  resetReadModalState();
  if (location.pathname !== path) history.pushState({}, "", path);
  rerender();
}

function rerender() {
  const page = getCurrentPath();
  renderLayout(app, page);
  bindEvents({ page, navigate, rerender });
  syncReadModal();
}

window.addEventListener("popstate", () => {
  resetReadModalState();
  rerender();
});
rerender();
