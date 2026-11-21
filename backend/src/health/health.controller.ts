import { Controller, Get } from "@nestjs/common";

/** Sinal de vida para o HEALTHCHECK da imagem: só diz que a API responde, sem nenhum dado. */
@Controller("health")
export class HealthController {
	@Get()
	health() {
		return { ok: true };
	}
}
