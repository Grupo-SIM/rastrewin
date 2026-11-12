import { Module } from "@nestjs/common";
import { EmailModule } from "../email/email.module";
import { PrivacyController } from "./privacy.controller";
import { PrivacyService } from "./privacy.service";

@Module({ controllers: [PrivacyController], imports: [EmailModule], providers: [PrivacyService] })
export class PrivacyModule {}
