import { Module } from "@nestjs/common";
import { EmailModule } from "../email/email.module";
import { AuthController } from "./auth.controller";

@Module({ controllers: [AuthController], imports: [EmailModule] })
export class AuthModule {}
