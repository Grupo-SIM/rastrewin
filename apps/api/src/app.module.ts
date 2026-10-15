import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.service';
import { UsersModule } from './users/users.module';
import { RafflesModule } from './raffles/raffles.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, UsersModule, RafflesModule, AdminModule],
})
export class AppModule {}
