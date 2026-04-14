// @ts-nocheck
import "./style.css";
import { getCurrentPath } from "./core/state";
import { bindEvents } from "./features/events";
import { renderLayout, renderBooks } from "./ui/render";

const app = document.querySelector("#app");
if (!app) throw new Error("App root not found");

function navigate(path) {
  if (location.pathname !== path) history.pushState({}, "", path);
  rerender();
}

function rerender() {
  const page = getCurrentPath();
  renderLayout(app, page);
  bindEvents({ page, navigate, rerender });
  if (page === "/library") renderBooks();
}

window.addEventListener("popstate", rerender);
rerender();
