/* Version: 1.1.0 */
/* Updated: 2026-11-16 */
import { renderWorkspaceView } from "../../design-sistem/workspace-view.js";
export function mountWorkspace(container, user, section = "projects", profileData = null) {
 renderWorkspaceView(container, user, section, profileData);
}
