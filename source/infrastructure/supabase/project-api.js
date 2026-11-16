/* Version: 1.0.0 */
/* Updated: 2026-11-16 */

/**
 * Supabase RPC adapter for the Project domain.
 * Session management and HTTP transport are supplied by the authentication
 * infrastructure so this adapter does not own authentication state.
 */
export function createProjectApi({ getSession, request }) {
  async function authenticatedRequest(path, body) {
    const session = await getSession();
    if (!session) {
      throw new Error("Сессия пользователя не найдена. Войдите в аккаунт повторно.");
    }
    return request(path, {
      method: "POST",
      accessToken: session.access_token,
      body,
    });
  }

  return {
    async createProject({ name, description, projectType, componentCodes = [] }) {
      return authenticatedRequest("/rest/v1/rpc/project_create", {
        p_parent_project_id: null,
        p_name: String(name || "").trim(),
        p_description: String(description || "").trim() || null,
        p_project_type: projectType,
        p_component_codes: projectType === "online" ? componentCodes : [],
      });
    },

    async getProjects() {
      return authenticatedRequest("/rest/v1/rpc/project_list", {});
    },

    async getProjectMembers(projectId) {
      return authenticatedRequest("/rest/v1/rpc/project_members_list", {
        p_project_id: projectId,
      });
    },

    async addProjectMember({ projectId, username, roleId }) {
      return authenticatedRequest("/rest/v1/rpc/project_member_add", {
        p_project_id: projectId,
        p_username: String(username || "").trim().toLowerCase(),
        p_role_id: roleId,
      });
    },
  };
}
