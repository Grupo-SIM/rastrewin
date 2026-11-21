import type { Metadata } from "next";

/** Área de conta: fica fora dos buscadores (a página é client component, por isso o metadata mora aqui). */
export const metadata: Metadata = { robots: { follow: false, index: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
	return children;
}
