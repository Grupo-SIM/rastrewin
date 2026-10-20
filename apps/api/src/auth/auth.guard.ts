import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { verifyToken } from './jwt.util';

function check(ctx: ExecutionContext, requiredRole?: string) {
  const req = ctx.switchToHttp().getRequest();
  const header = req.headers['authorization'];
  const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) return false;
  try {
    const payload = verifyToken(token);
    if (requiredRole && payload.role !== requiredRole) return false;
    req.auth = payload;
    return true;
  } catch {
    return false;
  }
}

/** Exige um JWT válido de qualquer usuário. Anexa req.auth = { sub, role }. */
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    return check(ctx);
  }
}

/** Exige um JWT válido com role ADMIN. */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    return check(ctx, 'ADMIN');
  }
}
