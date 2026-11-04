import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Redirecionamento OTIMISTA: sem cookie de sessão → /login.
 * A validação real da sessão acontece no servidor (src/lib/dal.ts) a cada leitura.
 */
export function proxy(request: NextRequest) {
	if (!getSessionCookie(request)) {
		const url = new URL("/login", request.url);
		url.searchParams.set("next", request.nextUrl.pathname);
		return NextResponse.redirect(url);
	}
	return NextResponse.next();
}

export const config = {
	matcher: ["/painel/:path*"],
};
