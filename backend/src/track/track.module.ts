import { Module } from "@nestjs/common";
import { TrackRelayService } from "./track-relay.service";

@Module({ exports: [TrackRelayService], providers: [TrackRelayService] })
export class TrackModule {}
