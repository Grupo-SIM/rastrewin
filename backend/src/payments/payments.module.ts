import { Module } from "@nestjs/common";
import { EmailModule } from "../email/email.module";
import { PaymentsController } from "./payments.controller";

@Module({ controllers: [PaymentsController], imports: [EmailModule] })
export class PaymentsModule {}
