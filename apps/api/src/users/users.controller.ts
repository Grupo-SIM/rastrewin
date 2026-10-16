import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { VISIBLE_AFTER_END_MS } from '../raffles/raffles.controller';

class RegisterDto {
  @IsString() @MinLength(2) name: string;
  @IsEmail() email: string;
  @IsString() @MinLength(11) cpf: string;
  @IsString() @MinLength(8) phone: string;
  @IsString() @MinLength(2) city: string;
  @IsIn(['basico', 'pro', 'vip']) plan: string;
}

class LoginDto {
  @IsEmail() email: string;
}

@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  /** Cadastro + pagamento (mock): cria o usuário e inscreve nos sorteios visíveis (abertos e recém-encerrados). */
  @Post()
  async register(@Body() dto: RegisterDto) {
    const user = await this.prisma.user.upsert({
      where: { email: dto.email },
      update: { ...dto, paidAt: new Date() },
      create: dto,
    });
    const open = await this.prisma.raffle.findMany({ where: { endsAt: { gt: new Date(Date.now() - VISIBLE_AFTER_END_MS) } }, select: { id: true } });
    await this.prisma.entry.createMany({
      data: open.map((r) => ({ userId: user.id, raffleId: r.id })),
      skipDuplicates: true,
    });
    return user;
  }

  /** Login mockado: só o e-mail (sem senha) por enquanto. */
  @Post('login')
  async login(@Body() dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
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
