import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PrismaService } from '../../config/prisma.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user; // set by JwtStrategy.validate

    if (!user?.auth0Id) throw new ForbiddenException('No user');

    // fetch DB user role
    const dbUser = await this.prisma.user.findUnique({
      where: { auth0Id: user.auth0Id },
    });
    const role = dbUser?.role ?? 'USER';

    const allowed = requiredRoles.includes(role);
    if (!allowed) throw new ForbiddenException('Insufficient role');
    return true;
  }
}
