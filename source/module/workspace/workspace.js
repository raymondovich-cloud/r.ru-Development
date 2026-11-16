/* Version: 1.5.0 */
/* Updated: 2026-11-16 */
import { renderWorkspaceView } from "../../design-sistem/workspace-view.js";
import { authClient } from "../../infrastructure/supabase/auth-client.js";

let profileScrollFrame = 0;
let workspaceMountSequence = 0;
let lastWorkspaceMount = null;

function syncProfileIdentityCard() {
 const card = document.querySelector(".profile-identity-card");
 if (!card) return;
 const isCollapsed = card.classList.contains("is-collapsed");
 const shouldCollapse = isCollapsed ? window.scrollY > 20 : window.scrollY > 64;
 card.classList.toggle("is-collapsed", shouldCollapse);
}

function installProfileScrollBehavior() {
 if (window.__raymondovichProfileScrollInstalled) return;
 window.__raymondovichProfileScrollInstalled = true;
 window.addEventListener("scroll", () => {
  if (profileScrollFrame) return;
  profileScrollFrame = window.requestAnimationFrame(() => {
   profileScrollFrame = 0;
   syncProfileIdentityCard();
  });
 }, { passive: true });
}

function installProjectRetry(container) {
 if (container.dataset.projectRetryBound === "true") return;
 container.dataset.projectRetryBound = "true";
 container.addEventListener("click", (event) => {
  if (!event.target.closest("[data-project-retry]") || !lastWorkspaceMount) return;
  const { user, profileData } = lastWorkspaceMount;
  mountWorkspace(container, user, "projects", profileData);
 });
}

function currentRoute() {
 return window.location.hash.replace(/^#/, "").split("?")[0] || "home";
}

export function mountWorkspace(container, user, section = "projects", profileData = null) {
 const sequence = ++workspaceMountSequence;
 lastWorkspaceMount = { user, profileData };
 renderWorkspaceView(
  container,
  user,
  section,
  profileData,
  section === "projects" ? { status: "loading" } : null
 );
 installProfileScrollBehavior();
 installProjectRetry(container);
 syncProfileIdentityCard();

 if (section !== "projects") return;

 authClient.getProjects().then((payload) => {
  if (sequence !== workspaceMountSequence || currentRoute() !== "projects") return;
  const projects = Array.isArray(payload?.projects) ? payload.projects : [];
  renderWorkspaceView(container, user, section, profileData, { status: "ready", projects });
  syncProfileIdentityCard();
 }).catch((error) => {
  if (sequence !== workspaceMountSequence || currentRoute() !== "projects") return;
  renderWorkspaceView(container, user, section, profileData, {
   status: "error",
   message: error?.message || "Не удалось получить список проектов."
  });
 });
}
