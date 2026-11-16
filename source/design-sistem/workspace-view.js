/* Version: 1.1.0 */
/* Updated: 2026-11-16 */
const sections = [
 { id: "projects", label: "Проекты", icon: '<rect x="3" y="4" width="18" height="16" rx="3"></rect><path d="M8 4V2m8 2V2M3 10h18"></path>' },
 { id: "ideas", label: "Идеи", icon: '<path d="M9 18h6m-5 3h4m-2-19a7 7 0 0 0-4 12.7c.6.4 1 1.1 1 1.8h6c0-.7.4-1.4 1-1.8A7 7 0 0 0 12 2Z"></path>' },
 { id: "team", label: "Команда", icon: '<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm6-7.5a4 4 0 0 1 0 7.7M20 21v-2a4 4 0 0 0-3-3.9"></path>' },
 { id: "tools", label: "Инструменты", icon: '<path d="m14.7 6.3 3 3M4 20l4.2-1 10.5-10.5a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z"></path>' },
 { id: "profile", label: "Профиль", icon: '<circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path>' }
];
function navigationMarkup(className, active) {
 return '<nav class="' + className + '" aria-label="Разделы рабочего пространства">' + sections.map((section) =>
  '<a class="workspace-nav-link" href="#' + section.id + '" ' + (section.id === active ? 'aria-current="page"' : '') + '><span class="workspace-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24">' + section.icon + '</svg></span><span>' + section.label + '</span></a>'
 ).join("") + '</nav>';
}
function escapeHtml(value) {
 return String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
 }[character]));
}
function initials(fullName, username) {
 const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
 if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
 if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
 return String(username || "R").slice(0, 2).toUpperCase();
}
function profileMarkup(user) {
 const metadata = user?.user_metadata || {};
 const fullName = metadata.full_name || metadata.name || "Имя не указано";
 const username = metadata.username || "";
 const avatar = initials(metadata.full_name || metadata.name, username);
 return '<div class="profile-page">' +
  '<section class="profile-identity-card" aria-label="Карточка пользователя"><div class="profile-avatar" aria-hidden="true">' + escapeHtml(avatar) + '</div><div class="profile-identity-copy"><h2>' + escapeHtml(fullName) + '</h2>' +
  (username ? '<p class="profile-username">@' + escapeHtml(username) + '</p>' : '<p class="profile-username">Логин не указан</p>') +
  '<span class="profile-status"><span class="profile-status-dot"></span>Аккаунт активен</span></div></section>' +
  '<div class="profile-sections">' +
  '<section class="profile-group profile-control-card"><div class="profile-control-symbol" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 19V5m0 14h16M8 15V9m4 6V5m4 10v-4m4 4V7"></path></svg></div><div class="profile-row-copy"><h2>Центр управления</h2><p>Управление экосистемой для пользователей с соответствующими правами.</p></div><span class="profile-access-label">По правам</span></section>' +
  '<a class="profile-group profile-link-card" href="#projects"><span class="profile-row-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3"></rect><path d="M8 4V2m8 2V2M3 10h18"></path></svg></span><span class="profile-row-copy"><strong>Действующие проекты</strong><small>Запущенные проекты, в которых вы участвуете.</small></span><span class="profile-chevron" aria-hidden="true">›</span></a>' +
  '<a class="profile-group profile-link-card" href="#tools"><span class="profile-row-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m14.7 6.3 3 3M4 20l4.2-1 10.5-10.5a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z"></path></svg></span><span class="profile-row-copy"><strong>Инструменты экосистемы</strong><small>Инструменты, доступные вашему аккаунту.</small></span><span class="profile-chevron" aria-hidden="true">›</span></a>' +
  '<section class="profile-group profile-static-card"><span class="profile-row-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5V21H3Z"></path><path d="M9 21v-7h6v7"></path></svg></span><span class="profile-row-copy"><strong>Витрина проектов</strong><small>Знакомство с проектами экосистемы.</small></span><span class="profile-soon-label">Скоро</span></section>' +
  '<section class="profile-group profile-static-card"><span class="profile-row-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"></path></svg></span><span class="profile-row-copy"><strong>Избранное</strong><small>Сохранённые проекты и материалы.</small></span><span class="profile-soon-label">Скоро</span></section>' +
  '<a class="profile-group profile-link-card" href="#settings"><span class="profile-row-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.5"></circle><path d="M19.4 15a1.8 1.8 0 0 0 .9 2.1l.1.1-2.5 2.5-.1-.1a1.8 1.8 0 0 0-2.1-.9 1.8 1.8 0 0 0-1.2 1.7v.2h-3.6v-.2a1.8 1.8 0 0 0-1.2-1.7 1.8 1.8 0 0 0-2.1.9l-.1.1L5 17.2l.1-.1A1.8 1.8 0 0 0 6 15a1.8 1.8 0 0 0-1.7-1.2h-.2v-3.6h.2A1.8 1.8 0 0 0 6 9a1.8 1.8 0 0 0-.9-2.1L5 6.8l2.5-2.5.1.1a1.8 1.8 0 0 0 2.1.9A1.8 1.8 0 0 0 11 3.6v-.2h3.6v.2a1.8 1.8 0 0 0 1.2 1.7 1.8 1.8 0 0 0 2.1-.9l.1-.1 2.5 2.5-.1.1a1.8 1.8 0 0 0-.9 2.1 1.8 1.8 0 0 0 1.7 1.2h.2v3.6h-.2a1.8 1.8 0 0 0-1.8 1.2Z"></path></svg></span><span class="profile-row-copy"><strong>Настройки</strong><small>Данные профиля, оформление и аккаунт.</small></span><span class="profile-chevron" aria-hidden="true">›</span></a>' +
  '</div><button class="profile-signout" type="button" data-auth-signout>Выйти из аккаунта</button></div>';
}
export function renderWorkspaceView(container, user, activeSection) {
 const active = sections.some((section) => section.id === activeSection) ? activeSection : "projects";
 const title = sections.find((section) => section.id === active).label;
 const isProjects = active === "projects";
 const content = active === "profile"
  ? profileMarkup(user)
  : isProjects
   ? '<div class="workspace-empty-state"><div class="workspace-empty-inner"><div class="workspace-empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3"></rect><path d="M8 4V2m8 2V2M3 10h18M8 15h3"></path></svg></div><h2>Проекты будут отображаться здесь</h2><p>Здесь соберутся проекты, в которых вы участвуете: созданные вами и те, к которым вас пригласили.</p></div></div><p class="workspace-section-notice">Подключение списка проектов и управление участием — следующий этап разработки.</p>'
   : '<div class="workspace-empty-state"><div class="workspace-empty-inner"><div class="workspace-empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5m0-8h.01"></path></svg></div><h2>Раздел подключим следующим этапом</h2><p>Навигация уже общая для рабочего пространства. Функциональность раздела будет добавлена отдельно.</p></div></div>';
 container.innerHTML = '<div class="workspace-layout">' + navigationMarkup("workspace-sidebar", active) +
  '<section class="workspace-content" aria-labelledby="workspace-title"><header class="workspace-page-heading"><div><h1 id="workspace-title">' + title + '</h1><p>' +
  (active === "profile" ? "Ваш аккаунт и возможности в экосистеме Raymondovich." : isProjects ? "Все проекты, в которых вы участвуете, независимо от того, кто их создал." : "Рабочее пространство Raymondovich.") +
  '</p></div></header>' + content + '</section></div>' + navigationMarkup("workspace-mobile-nav", active);
}
