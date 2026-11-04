import {
	ActivityIcon,
	BanknoteIcon,
	EarthIcon,
	LayoutDashboardIcon,
	type LucideIcon,
	MegaphoneIcon,
	SettingsIcon,
} from "lucide-react";

export interface NavItem {
	href: string;
	label: string;
	/** Rótulo curto para a barra inferior do celular */
	short: string;
	icon: LucideIcon;
	/** Aparece na barra inferior (mobile). Os demais vão para "Mais". */
	primary: boolean;
}

export const NAV_ITEMS: NavItem[] = [
	{ href: "/painel", icon: LayoutDashboardIcon, label: "Visão geral", primary: true, short: "Início" },
	{ href: "/painel/eventos", icon: ActivityIcon, label: "Eventos", primary: true, short: "Eventos" },
	{ href: "/painel/faturamento", icon: BanknoteIcon, label: "Faturamento", primary: true, short: "Vendas" },
	{ href: "/painel/campanhas", icon: MegaphoneIcon, label: "Campanhas", primary: true, short: "Campanhas" },
	{ href: "/painel/geo", icon: EarthIcon, label: "Geo", primary: false, short: "Geo" },
	{ href: "/painel/config", icon: SettingsIcon, label: "Configurações", primary: false, short: "Config" },
];

export function isActive(pathname: string, href: string) {
	if (href === "/painel") return pathname === "/painel";
	return pathname === href || pathname.startsWith(`${href}/`);
}
