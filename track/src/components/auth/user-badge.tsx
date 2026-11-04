import { getSession } from "@/lib/dal";
import { LogoutButton } from "./logout-button";

export async function UserBadge() {
  const session = await getSession();
  if (!session) return null;
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{session.user.name}</p>
        <p className="truncate text-xs text-muted-foreground">{session.user.email}</p>
      </div>
      <LogoutButton />
    </div>
  );
}
