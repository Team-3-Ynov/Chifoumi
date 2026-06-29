import { Inject, Injectable } from "@nestjs/common";
import { type CurrentUserProfile, UserService } from "../user-service/user.service.js";

export type MeProfile = CurrentUserProfile;

@Injectable()
export class MeService {
  constructor(@Inject(UserService) private readonly userService: UserService) {}

  async getProfile(userId: string): Promise<MeProfile> {
    return this.userService.getCurrentProfile(userId);
  }
}
