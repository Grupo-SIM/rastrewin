import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { EmailModule } from '../email/email.module';

@Module({ imports: [EmailModule], controllers: [PaymentsController] })
export class PaymentsModule {}
