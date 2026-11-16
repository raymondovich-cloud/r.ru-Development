/* Version: 1.7.0 */
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

function installProjectMemberActions(container) {
 if (container.dataset.projectMemberActionsBound === "true") return;
 container.dataset.projectMemberActionsBound = "true";
 container.addEventListener("click", (event) => {
  if (!event.target.closest("[data-project-members-retry]") || !lastWorkspaceMount) return;
  const { user, profileData } = lastWorkspaceMount;
  mountWorkspace(container, user, currentRoute(), profileData);
 });
 container.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-project-member-form]");
  if (!form || form.dataset.submitting === "true") return;
  event.preventDefault();
  if (!form.reportValidity()) return;
  const route = currentRoute();
  const projectId = decodeURIComponent(route.slice("projects/".length));
  const feedback = form.querySelector("[data-project-member-feedback]");
  const button = form.querySelector('button[type="submit"]');
  form.dataset.submitting = "true";
  if (button) { button.disabled = true; button.textContent = "Добавление…"; }
  if (feedback) { feedback.textContent = ""; feedback.dataset.state = ""; }
  try {
   await authClient.addProjectMember({
    projectId,
    username: new FormData(form).get("username"),
    roleId: new FormData(form).get("role_id")
   });
   mountWorkspace(container, lastWorkspaceMount.user, route, lastWorkspaceMount.profileData);
  } catch (error) {
   if (feedback) {
    const message = error?.message || "";
    feedback.textContent = /User with this username was not found/i.test(message) ? "Пользователь с таким логином не найден." :
     /already a project member/i.test(message) ? "Этот пользователь уже состоит в проекте." :
     /permission|42501/i.test(message) ? "Недостаточно прав для добавления участника или назначения этой роли." :
     message || "Не удалось добавить участника.";
    feedback.dataset.state = "error";
   }
   form.dataset.submitting = "false";
   if (button) { button.disabled = false; button.textContent = "Добавить участника"; }
  }
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
  (section === "projects" || section.startsWith("projects/")) ? { status: "loading" } : null
 );
 installProfileScrollBehavior();
 installProjectRetry(container);
 installProjectMemberActions(container);
 syncProfileIdentityCard();

 if (section !== "projects" && !section.startsWith("projects/")) return;

 authClient.getProjects().then((payload) => {
  if (sequence !== workspaceMountSequence || currentRoute() !== section) return;
  const projects = Array.isArray(payload?.projects) ? payload.projects : [];
  if (section.startsWith("projects/")) {
   const projectId = decodeURIComponent(section.slice("projects/".length));
   const project = projects.find((item) => String(item.id) === projectId) || null;
   let membersData = { status: "ready", members: [], roles: [], can_invite: false };
   if (project) {
    try {
     membersData = { status: "ready", ...(await authClient.getProjectMembers(projectId)) };
    } catch (error) {
     membersData = { status: "error", message: error?.message || "Не удалось загрузить участников." };
    }
   }
   if (sequence !== workspaceMountSequence || currentRoute() !== section) return;
   renderWorkspaceView(container, user, section, profileData, { status: "ready", project, membersData });
  } else {
   renderWorkspaceView(container, user, section, profileData, { status: "ready", projects });
  }
  syncProfileIdentityCard();
 }).catch((error) => {
  if (sequence !== workspaceMountSequence || currentRoute() !== section) return;
  renderWorkspaceView(container, user, section, profileData, {
   status: "error",
   message: error?.message || "Не удалось получить список проектов."
  });
 });
}
