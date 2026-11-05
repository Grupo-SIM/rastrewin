import { Module } from "@nestjs/common";
import { EmailModule } from "../email/email.module";
import { TrackModule } from "../track/track.module";
import { PaymentsController } from "./payments.controller";

@Module({ controllers: [PaymentsController], imports: [EmailModule, TrackModule] })
export class PaymentsModule {}
