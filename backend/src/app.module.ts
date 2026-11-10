import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AdminModule } from "./admin/admin.module";
import { AuthModule } from "./auth/auth.module";
import { PaymentsModule } from "./payments/payments.module";
import { PrismaModule } from "./prisma/prisma.service";
import { PrivacyModule } from "./privacy/privacy.module";
import { RafflesModule } from "./raffles/raffles.module";
import { UsersModule } from "./users/users.module";
import { WhatsappModule } from "./whatsapp/whatsapp.module";

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true }),
		PrismaModule,
		UsersModule,
		RafflesModule,
		AdminModule,
		PaymentsModule,
		PrivacyModule,
		AuthModule,
		WhatsappModule,
	],
})
export class AppModule {}
