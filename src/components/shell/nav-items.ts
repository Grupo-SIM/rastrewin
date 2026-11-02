import {
  ActivityIcon,
  BanknoteIcon,
  EarthIcon,
  LayoutDashboardIcon,
  MegaphoneIcon,
  SettingsIcon,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  /** Rótulo curto para a barra inferior do celular */
  short: string;
  icon: LucideIcon;
  /** Aparece na barra inferior (mobile). Os demais vão para "Mais". */
  primary: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/painel", label: "Visão geral", short: "Início", icon: LayoutDashboardIcon, primary: true },
  { href: "/painel/eventos", label: "Eventos", short: "Eventos", icon: ActivityIcon, primary: true },
  { href: "/painel/faturamento", label: "Faturamento", short: "Vendas", icon: BanknoteIcon, primary: true },
  { href: "/painel/campanhas", label: "Campanhas", short: "Campanhas", icon: MegaphoneIcon, primary: true },
  { href: "/painel/geo", label: "Geo", short: "Geo", icon: EarthIcon, primary: false },
  { href: "/painel/config", label: "Configurações", short: "Config", icon: SettingsIcon, primary: false },
];

export function isActive(pathname: string, href: string) {
  if (href === "/painel") return pathname === "/painel";
  return pathname === href || pathname.startsWith(`${href}/`);
}
