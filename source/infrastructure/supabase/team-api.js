/* Version: 1.2.0 */
/* Updated: 2026-11-24 */

/**
 * Supabase RPC adapter for the independent Team domain.
 * All authorization is enforced by the database RPC boundary.
 */
export function createTeamApi({ getSession, request }) {
  async function authenticatedRequest(name, body = {}) {
    const session = await getSession();
    if (!session) {
      throw new Error("Сессия пользователя не найдена. Войдите в аккаунт повторно.");
    }
    return request(`/rest/v1/rpc/${name}`, {
      method: "POST",
      accessToken: session.access_token,
      body,
    });
  }

  return {
    async createTeam({ name, description }) {
      return authenticatedRequest("team_create", {
        p_name: name,
        p_description: description || null,
      });
    },
    async getTeams() {
      return authenticatedRequest("team_list");
    },
    async getTeam(teamId) {
      return authenticatedRequest("team_get", { p_team_id: teamId });
    },
    async getTeamMembers(teamId) { return authenticatedRequest("team_members_list", { p_team_id: teamId }); },
    async inviteToTeam({ teamId, username, role, message }) { return authenticatedRequest("team_invite", { p_team_id: teamId, p_username: username, p_role: role, p_message: message || null }); },
    async getTeamInvitations(teamId) { return authenticatedRequest("team_invitations_list", { p_team_id: teamId }); },
    async cancelTeamInvitation(id) { return authenticatedRequest("team_invitation_cancel", { p_invitation_id: id }); },
    async acceptTeamInvitation(id) { return authenticatedRequest("team_invitation_accept", { p_invitation_id: id }); },
    async declineTeamInvitation(id) { return authenticatedRequest("team_invitation_decline", { p_invitation_id: id }); },
  };
}
