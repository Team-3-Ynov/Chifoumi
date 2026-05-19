import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import type { SafeUser } from "../users/users.service.js";

type AuthenticatedRequest = { user: SafeUser };

@Controller("me")
export class MeController {
  @UseGuards(JwtAuthGuard)
  @Get()
  getMe(@Req() req: AuthenticatedRequest): { user: SafeUser } {
    return { user: req.user };
  }
}
