import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { PLAN_IDS } from '../plans';
import { toPublicUser } from './user.view';

class RegisterDto {
  @IsString() @MinLength(2) name: string;
  @IsEmail() email: string;
  @IsString() @MinLength(11) cpf: string;
  @IsString() @MinLength(8) phone: string;
  @IsString() @MinLength(2) city: string;
  @IsString() @MinLength(3) pix: string;
  @IsIn(PLAN_IDS) plan: string;
}

@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  /** Cadastro: salva os dados como PENDING e devolve o link de checkout. A liberação do plano
   * (e a senha de acesso) só acontece quando o webhook de pagamento confirmar (ver PaymentsController). */
  @Post()
  async register(@Body() dto: RegisterDto) {
    const checkoutUrl = process.env.SIMPAY_CHECKOUT_URL;
    if (!checkoutUrl) throw new BadRequestException('Checkout não configurado');
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.upsert({
      where: { email },
      update: { ...dto, email, status: 'PENDING', paidAt: null },
      create: { ...dto, email, status: 'PENDING' },
    });
    return { ...toPublicUser(user), checkoutUrl };
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return toPublicUser(user);
  }
}
