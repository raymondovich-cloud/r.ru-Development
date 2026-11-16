/* Version: 1.2.0 */
/* Updated: 2026-11-16 */

import { authClient } from "../../infrastructure/supabase/auth-client.js";
import { mountWorkspace } from "../workspace/workspace.js";
import {
  renderAuthenticationView,
  renderAuthenticatedView,
  setAuthenticationMessage,
  setAuthenticationLoading,
} from "../../design-sistem/authentication-view.js";

const root = document.querySelector("[data-auth-root]");
const statusPanel = document.querySelector(".status-panel");
const pageMain = document.querySelector(".page-main");
const backButton = document.querySelector("[data-page-back]");

if (root && pageMain) {
  const validModes = new Set(["login", "register", "forgot-password", "reset-password"]);
  const workspaceRoutes = new Set(["projects", "ideas", "team", "tools", "profile"]);
  let currentMode = "login";
  let busy = false;

  function setRoute(mode) {
    currentMode = mode;
    const isAuthRoute = validModes.has(mode);
    const isWorkspaceRoute = mode === "account" || workspaceRoutes.has(mode);
    root.hidden = !(isAuthRoute || isWorkspaceRoute);
    if (statusPanel) statusPanel.hidden = isAuthRoute || isWorkspaceRoute;
    document.body.dataset.appState = isWorkspaceRoute ? "workspace" : "public";

    if (isWorkspaceRoute) {
      authClient.getUser().then(async (user) => {
        if (!user) {
          window.location.hash = "login";
          return;
        }
        if (mode === "account") {
          window.location.hash = "projects";
          return;
        }
        const profileData = await authClient.getProfile().catch(() => null);
        mountWorkspace(root, user, mode, profileData);
      }).catch(() => {
        window.location.hash = "login";
      });
      return;
    }
    if (!isAuthRoute) return;
    renderAuthenticationView(root, mode);
  }

  backButton?.addEventListener("click", () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.hash = "home";
    }
  });

  function showMessage(message, kind = "info") {
    setAuthenticationMessage(root, message, kind);
  }

  function normalizeError(error) {
    const message = error?.message || "";
    if (/already registered|already been registered|user already exists/i.test(message)) {
      return "Этот адрес электронной почты уже зарегистрирован.";
    }
    if (/password should be at least|weak password/i.test(message)) {
      return "Пароль слишком простой. Используйте не менее 8 символов.";
    }
    if (/username|duplicate key|unique constraint/i.test(message)) {
      return "Этот логин уже занят или имеет недопустимый формат.";
    }
    if (/invalid login credentials/i.test(message)) {
      return "Неверный логин или пароль.";
    }
    if (/email not authorized/i.test(message)) {
      return "Отправка писем пока не настроена для этого адреса. Проверьте SMTP в Supabase.";
    }
    return message || "Не удалось выполнить операцию. Попробуйте позже.";
  }

  function parseRedirectSession() {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const type = params.get("type");
    const errorDescription = params.get("error_description");

    if (errorDescription) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      window.location.hash = "login";
      window.setTimeout(() => {
        renderAuthenticationView(root, "login", errorDescription.replaceAll("+", " "), "error");
      }, 0);
      return;
    }

    if (!accessToken || !refreshToken) return;

    authClient.acceptRedirectSession({
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: Number(params.get("expires_in") || 3600),
      token_type: params.get("token_type") || "bearer",
    });

    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    if (type === "recovery") {
      window.location.hash = "reset-password";
    } else {
      window.location.hash = "account";
    }
  }

  root.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-auth-form]");
    if (!form || busy) return;
    event.preventDefault();

    const mode = form.dataset.mode;
    const values = Object.fromEntries(new FormData(form).entries());
    const submitButton = form.querySelector(".auth-submit");

    if (!form.reportValidity()) return;
    if (values.password && values.password.length < 8) {
      showMessage("Пароль должен содержать не менее 8 символов.", "error");
      return;
    }
    if (values.password !== values.passwordConfirm && values.passwordConfirm !== undefined) {
      showMessage("Пароли не совпадают.", "error");
      return;
    }
    if (mode === "register" && new Date(values.birthDate).getTime() > Date.now()) {
      showMessage("Дата рождения не может быть в будущем.", "error");
      return;
    }

    busy = true;
    if (submitButton) {
      submitButton.dataset.defaultLabel = submitButton.textContent;
      setAuthenticationLoading(root, true);
    }

    try {
      if (mode === "register") {
        const username = values.username.trim().toLowerCase();
        if (!/^[a-z0-9][a-z0-9._-]{2,23}$/.test(username)) {
          throw new Error("Логин должен содержать 3–24 символа: латинские буквы, цифры, точку, дефис или подчёркивание.");
        }
        await authClient.signUp({
          email: values.email,
          password: values.password,
          fullName: values.fullName,
          birthDate: values.birthDate,
          username,
        });
        renderAuthenticationView(root, "login", "Аккаунт создан. Проверьте электронную почту и перейдите по ссылке подтверждения, чтобы завершить регистрацию.", "success");
      } else if (mode === "login") {
        await authClient.signIn(values.identifier, values.password);
        window.location.hash = "projects";
      } else if (mode === "forgot-password") {
        await authClient.requestPasswordReset(values.email);
        showMessage("Если аккаунт с таким адресом существует, письмо для восстановления пароля отправлено.", "success");
      } else if (mode === "reset-password") {
        await authClient.updatePassword(values.password);
        window.location.hash = "projects";
      }
    } catch (error) {
      showMessage(normalizeError(error), "error");
    } finally {
      busy = false;
      if (root.querySelector("[data-auth-form]")) setAuthenticationLoading(root, false);
    }
  });

  root.addEventListener("click", async (event) => {
    if (!event.target.closest("[data-auth-signout]") || busy) return;
    busy = true;
    try {
      await authClient.signOut();
      window.location.hash = "login";
    } catch (error) {
      showMessage(normalizeError(error), "error");
    } finally {
      busy = false;
    }
  });

  window.addEventListener("hashchange", () => {
    const route = window.location.hash.replace(/^#/, "").split("?")[0] || "home";
    setRoute(route);
  });

  parseRedirectSession();
  const initialRoute = window.location.hash.replace(/^#/, "").split("?")[0] || "home";
  setRoute(initialRoute);
}
