import jwt from "jsonwebtoken";

function secret() {
	const s = process.env.JWT_SECRET;
	if (!s) throw new Error("JWT_SECRET não configurado");
	return s;
}

export interface AuthPayload {
	sub: string;
	role: string;
}

export function signToken(payload: AuthPayload) {
	return jwt.sign(payload, secret(), { expiresIn: "30d" });
}

export function verifyToken(token: string): AuthPayload {
	return jwt.verify(token, secret()) as AuthPayload;
}
