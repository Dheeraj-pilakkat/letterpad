import { requireWorkspace, listWorkspacesFor } from "@/lib/auth/session";
import { isAdminEmail } from "@/lib/admin";
import { listNotifications } from "@/lib/notify";
import { Sidebar } from "@/components/app/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, workspace } = await requireWorkspace();
  const workspaces = await listWorkspacesFor(user);
  const notifications = await listNotifications(user.id, 20);

  return (
    <div className="min-h-dvh bg-paper md:flex">
      {/* mobile top bar + drawer, then desktop aside — see Sidebar */}
      <Sidebar
        workspaceName={workspace.name}
        userName={user.name}
        userEmail={user.email}
        workspaces={workspaces}
        currentWorkspaceId={workspace._id.toHexString()}
        notifications={notifications.items}
        unreadCount={notifications.unread}
        isAdmin={isAdminEmail(user.email)}
      />
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:px-8 md:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
