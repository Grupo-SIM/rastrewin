"use client";

import { LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function LogoutButton() {
	const router = useRouter();
	return (
		<Button
			variant="ghost"
			size="icon"
			className="size-10 shrink-0"
			aria-label="Sair"
			onClick={async () => {
				await authClient.signOut();
				router.replace("/login");
				router.refresh();
			}}
		>
			<LogOutIcon className="size-4.5" />
		</Button>
	);
}
