/* Version: 1.0.0 */
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
export function renderWorkspaceView(container, user, activeSection) {
 const active = sections.some((section) => section.id === activeSection) ? activeSection : "projects";
 const title = sections.find((section) => section.id === active).label;
 const isProjects = active === "projects";
 const content = isProjects
  ? '<div class="workspace-empty-state"><div class="workspace-empty-inner"><div class="workspace-empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3"></rect><path d="M8 4V2m8 2V2M3 10h18M8 15h3"></path></svg></div><h2>Проекты будут отображаться здесь</h2><p>Здесь соберутся проекты, в которых вы участвуете: созданные вами и те, к которым вас пригласили.</p></div></div><p class="workspace-section-notice">Подключение списка проектов и управление участием — следующий этап разработки.</p>'
  : '<div class="workspace-empty-state"><div class="workspace-empty-inner"><div class="workspace-empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5m0-8h.01"></path></svg></div><h2>Раздел подключим следующим этапом</h2><p>Навигация уже общая для рабочего пространства. Функциональность раздела будет добавлена отдельно.</p></div></div>';
 container.innerHTML = '<div class="workspace-layout">' + navigationMarkup("workspace-sidebar", active) +
  '<section class="workspace-content" aria-labelledby="workspace-title"><header class="workspace-page-heading"><div><h1 id="workspace-title">' + title + '</h1><p>' +
  (isProjects ? "Все проекты, в которых вы участвуете, независимо от того, кто их создал." : "Рабочее пространство Raymondovich.") +
  '</p></div></header>' + content + '</section></div>' + navigationMarkup("workspace-mobile-nav", active);
}
