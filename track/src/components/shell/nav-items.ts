import {
	ActivityIcon,
	BanknoteIcon,
	EarthIcon,
	FileTextIcon,
	LayoutDashboardIcon,
	type LucideIcon,
	MegaphoneIcon,
	SettingsIcon,
	VideoIcon,
} from "lucide-react";

export interface NavItem {
	href: string;
	label: string;
	/** Rótulo curto para a barra inferior do celular */
	short: string;
	icon: LucideIcon;
	/** Aparece na barra inferior (mobile). Os demais vão para "Mais". */
	primary: boolean;
	/** Só Administrador vê no menu (a página também bloqueia no servidor). */
	adminOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
	{ href: "/painel", icon: LayoutDashboardIcon, label: "Visão geral", primary: true, short: "Início" },
	{ href: "/painel/eventos", icon: ActivityIcon, label: "Eventos", primary: true, short: "Eventos" },
	{ href: "/painel/faturamento", icon: BanknoteIcon, label: "Faturamento", primary: true, short: "Vendas" },
	{ href: "/painel/campanhas", icon: MegaphoneIcon, label: "Campanhas", primary: true, short: "Campanhas" },
	{ href: "/painel/paginas", icon: FileTextIcon, label: "Páginas", primary: false, short: "Páginas" },
	{ href: "/painel/videos", icon: VideoIcon, label: "Vídeos", primary: false, short: "Vídeos" },
	{ href: "/painel/geo", icon: EarthIcon, label: "Geo", primary: false, short: "Geo" },
	{
		adminOnly: true,
		href: "/painel/config",
		icon: SettingsIcon,
		label: "Configurações",
		primary: false,
		short: "Config",
	},
];

/** Itens do menu para o nível de quem está logado. Esconder aqui é só UX: o servidor bloqueia de verdade. */
export function navItemsFor(isAdmin: boolean): NavItem[] {
	return NAV_ITEMS.filter(item => isAdmin || !item.adminOnly);
}

export function isActive(pathname: string, href: string) {
	if (href === "/painel") return pathname === "/painel";
	return pathname === href || pathname.startsWith(`${href}/`);
}
