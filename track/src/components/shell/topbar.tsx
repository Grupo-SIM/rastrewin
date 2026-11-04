import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Logo } from "./logo";

/** Barra superior compacta — só no celular/tablet (no desktop a sidebar cumpre esse papel). */
export function Topbar() {
	return (
		<header className="glass sticky top-0 z-30 flex h-14 items-center justify-between border-x-0 border-t-0 px-4 lg:hidden">
			<Logo />
			<ThemeToggle />
		</header>
	);
}
