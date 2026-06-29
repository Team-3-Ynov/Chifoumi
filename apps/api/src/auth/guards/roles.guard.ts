import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { type AppRole, ROLES_KEY } from "../decorators/roles.decorator.js";

type RequestWithUser = { user?: { role?: AppRole } };

/**
 * Enforces the roles declared via {@link Roles}. Must run after the
 * JwtAuthGuard (e.g. `@UseGuards(JwtAuthGuard, RolesGuard)`) so that
 * `request.user` is already populated. When a handler declares no roles the
 * guard allows the request through, keeping it opt-in.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AppRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<RequestWithUser>();

    if (!user?.role || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException({ error: "FORBIDDEN" });
    }

    return true;
  }
}
