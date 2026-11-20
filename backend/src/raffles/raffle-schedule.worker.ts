import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { materializeSchedule } from "../schedule";
import { ensureWinners } from "./raffles.controller";

/** Um sorteio encerrado ganha o ganhador em até este intervalo (o dashboard atualiza a cada 5 s). */
const INTERVAL_MS = 5_000;

/**
 * Agenda de sorteios e ganhadores em segundo plano. Antes rodavam dentro de cada leitura da área do cliente e do
 * admin, numa fila única: com dezenas de clientes com a tela aberta (atualiza a cada 5 s), a fila crescia e cada
 * leitura esperava dezenas de segundos. Agora as rotas só leem; este worker grava a agenda e os ganhadores.
 */
@Injectable()
export class RaffleScheduleWorker implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(RaffleScheduleWorker.name);
	private timer?: NodeJS.Timeout;
	private running = false;

	constructor(private readonly prisma: PrismaService) {}

	onModuleInit() {
		void this.tick();
		this.timer = setInterval(() => void this.tick(), INTERVAL_MS);
		this.timer.unref();
	}

	onModuleDestroy() {
		clearInterval(this.timer);
	}

	private async tick() {
		if (this.running) return;
		this.running = true;
		try {
			await materializeSchedule(this.prisma);
			await ensureWinners(this.prisma);
		} catch (error) {
			this.logger.warn(`Agenda/ganhadores: ${error instanceof Error ? error.message : String(error)}`);
		} finally {
			this.running = false;
		}
	}
}
