import "reflect-metadata";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module";
import { rateLimitKey } from "./http/client-ip";
import { createRateLimiter } from "./http/rate-limit";

/** Teto geral por IP, para tudo que não tem limite próprio mais apertado (login, cadastro, webhooks...). */
const globalLimiter = createRateLimiter({ max: 300, windowMs: 60 * 1000 });

/** Cabeçalhos de uma API JSON: nada dela deve ser embutido, interpretado como página ou guardado por proxies. */
function securityHeaders(_req: Request, res: Response, next: NextFunction) {
	res.setHeader("X-Content-Type-Options", "nosniff");
	res.setHeader("X-Frame-Options", "DENY");
	res.setHeader("Referrer-Policy", "no-referrer");
	res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
	res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
	res.setHeader("Cross-Origin-Resource-Policy", "same-site");
	res.setHeader("Cache-Control", "no-store");
	next();
}

function globalRateLimit(req: Request, res: Response, next: NextFunction) {
	if (globalLimiter.take(rateLimitKey(req))) return next();
	res.status(429).json({ message: "Muitas requisições. Aguarde um pouco e tente de novo.", statusCode: 429 });
}

async function bootstrap() {
	const logger = new Logger("Bootstrap");
	if ((process.env.JWT_SECRET?.trim().length ?? 0) < 32)
		logger.warn("JWT_SECRET com menos de 32 caracteres: gere um com 48 bytes aleatórios (veja o .env.example)");
	// rawBody: o webhook do SimIntPay é assinado sobre os bytes exatos do corpo (payments.controller.ts).
	const app = await NestFactory.create(AppModule, { rawBody: true });
	app.getHttpAdapter().getInstance().disable("x-powered-by");
	// CORS antes do limite: a resposta 429 também precisa levar os cabeçalhos, senão o navegador não a lê.
	app.enableCors({
		allowedHeaders: ["Content-Type", "Authorization"],
		maxAge: 86_400,
		methods: ["GET", "POST", "PUT", "PATCH", "OPTIONS"],
		origin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
	});
	app.use(securityHeaders);
	app.use(globalRateLimit);
	// forbidNonWhitelisted: campo que o DTO não declara é recusado (400), em vez de descartado em silêncio.
	app.useGlobalPipes(new ValidationPipe({ forbidNonWhitelisted: true, transform: true, whitelist: true }));
	const port = Number(process.env.PORT ?? 3011);
	await app.listen(port);
	console.log(`API em http://localhost:${port}`);
}
bootstrap();
