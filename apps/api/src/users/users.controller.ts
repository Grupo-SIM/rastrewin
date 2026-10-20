import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { PLAN_IDS } from '../plans';

class RegisterDto {
  @IsString() @MinLength(2) name: string;
  @IsEmail() email: string;
  @IsString() @MinLength(11) cpf: string;
  @IsString() @MinLength(8) phone: string;
  @IsString() @MinLength(2) city: string;
  @IsString() @MinLength(3) pix: string;
  @IsIn(PLAN_IDS) plan: string;
}

class LoginDto {
  @IsEmail() email: string;
}

@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  /** Cadastro: salva os dados como PENDING e devolve o link de checkout. A liberação do plano
   * só acontece quando o webhook de pagamento confirmar (ver PaymentsController). */
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
    return { ...user, checkoutUrl };
  }

  /** Login mockado: só o e-mail (sem senha) por enquanto. */
  @Post('login')
  async login(@Body() dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.trim().toLowerCase() } });
    if (!user) throw new NotFoundException('E-mail não encontrado');
    return user;
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }
}
