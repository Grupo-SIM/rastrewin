import jwt from "jsonwebtoken";

const ISSUER = "rastrewin-api";
const AUDIENCE = "rastrewin-web";
const ALGORITHM = "HS256";
/** Sessão de 7 dias. Trocar ou redefinir a senha derruba todas antes (tokenVersion). */
const EXPIRES_IN = "7d";

function secret() {
	const s = process.env.JWT_SECRET?.trim();
	if (!s) throw new Error("JWT_SECRET não configurado");
	return s;
}

/** O token só prova QUEM é (sub) e de qual geração de senha (tv). A role e o status vêm sempre do banco. */
export interface AuthPayload {
	sub: string;
	tv: number;
}

export function signToken(payload: AuthPayload) {
	return jwt.sign({ tv: payload.tv }, secret(), {
		algorithm: ALGORITHM,
		audience: AUDIENCE,
		expiresIn: EXPIRES_IN,
		issuer: ISSUER,
		subject: payload.sub,
	});
}

export function verifyToken(token: string): AuthPayload {
	const p = jwt.verify(token, secret(), {
		algorithms: [ALGORITHM],
		audience: AUDIENCE,
		issuer: ISSUER,
	}) as jwt.JwtPayload;
	if (typeof p.sub !== "string" || typeof p.tv !== "number") throw new Error("token inválido");
	return { sub: p.sub, tv: p.tv };
}
