import { Body, Controller, Post, UnauthorizedException } from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { toPublicUser } from '../users/user.view';
import { comparePassword } from './password.util';
import { signToken } from './jwt.util';

class LoginDto {
  @IsEmail() email: string;
  @IsString() @MinLength(1) password: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.trim().toLowerCase() } });
    if (!user || !user.password || !(await comparePassword(dto.password, user.password))) {
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }
    const token = signToken({ sub: user.id, role: user.role });
    return { token, user: toPublicUser(user) };
  }
}
