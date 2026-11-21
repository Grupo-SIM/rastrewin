import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { verifyToken } from "./jwt.util";

export interface RequestAuth {
	sub: string;
	role: string;
}

function bearer(req: { headers: Record<string, unknown> }) {
	const header = req.headers.authorization;
	return typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7) : undefined;
}

/**
 * Confere o token E a conta no banco: a geração da senha (tokenVersion) tem de bater, então trocar ou
 * redefinir a senha derruba as sessões abertas, e a role vem do banco (admin rebaixado perde o acesso na hora).
 */
export async function authenticate(
	prisma: PrismaService,
	req: { headers: Record<string, unknown> },
): Promise<RequestAuth | null> {
	const token = bearer(req);
	if (!token) return null;
	try {
		const payload = verifyToken(token);
		const user = await prisma.user.findUnique({
			select: { id: true, role: true, tokenVersion: true },
			where: { id: payload.sub },
		});
		if (!user || user.tokenVersion !== payload.tv) return null;
		return { role: user.role, sub: user.id };
	} catch {
		return null;
	}
}

/** Exige um JWT válido de qualquer usuário. Anexa req.auth = { sub, role }. */
@Injectable()
export class AuthGuard implements CanActivate {
	constructor(private readonly prisma: PrismaService) {}

	async canActivate(ctx: ExecutionContext) {
		const req = ctx.switchToHttp().getRequest();
		const auth = await authenticate(this.prisma, req);
		if (!auth) throw new UnauthorizedException();
		req.auth = auth;
		return true;
	}
}

/** Exige um JWT válido com role ADMIN. */
@Injectable()
export class AdminGuard implements CanActivate {
	constructor(private readonly prisma: PrismaService) {}

	async canActivate(ctx: ExecutionContext) {
		const req = ctx.switchToHttp().getRequest();
		const auth = await authenticate(this.prisma, req);
		if (auth?.role !== "ADMIN") throw new UnauthorizedException();
		req.auth = auth;
		return true;
	}
}
