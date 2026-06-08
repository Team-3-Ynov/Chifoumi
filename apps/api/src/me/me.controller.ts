import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import type { SafeUser } from "../users/users.service.js";
import { type MeProfile, MeService } from "./me.service.js";

type AuthenticatedRequest = { user: SafeUser };

@Controller("me")
export class MeController {
  constructor(private readonly meService: MeService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  getMe(@Req() req: AuthenticatedRequest): Promise<MeProfile> {
    return this.meService.getProfile(req.user.id);
  }
}
