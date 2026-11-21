import { Module } from "@nestjs/common";
import { RaffleScheduleWorker } from "./raffle-schedule.worker";
import { RafflesController } from "./raffles.controller";

@Module({ controllers: [RafflesController], providers: [RaffleScheduleWorker] })
export class RafflesModule {}
