import { status as GrpcStatus } from "@grpc/grpc-js";
import { Controller, Inject } from "@nestjs/common";
import { GrpcMethod, RpcException } from "@nestjs/microservices";
import { UserService } from "../user-service/user.service.js";

@Controller()
export class UsersGrpcController {
  constructor(@Inject(UserService) private readonly userService: UserService) {}

  @GrpcMethod("Users", "GetRating")
  async getRating(data: { userId: string }) {
    try {
      const rating = await this.userService.getRating(data.userId);
      return {
        rating: rating.rating,
        gamesPlayed: rating.gamesPlayed,
      };
    } catch (error) {
      if (this.userService.isNotFoundError(error)) {
        throw new RpcException({ code: GrpcStatus.NOT_FOUND, message: "USER_NOT_FOUND" });
      }
      throw error;
    }
  }
}
