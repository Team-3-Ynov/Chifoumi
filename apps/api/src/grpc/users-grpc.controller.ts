import { status as GrpcStatus } from "@grpc/grpc-js";
import { Controller } from "@nestjs/common";
import { GrpcMethod, RpcException } from "@nestjs/microservices";
import { UsersService } from "../users/users.service.js";

@Controller()
export class UsersGrpcController {
  constructor(private readonly usersService: UsersService) {}

  @GrpcMethod("Users", "GetRating")
  async getRating(data: { userId: string }) {
    try {
      const rating = await this.usersService.getRating(data.userId);
      return {
        rating: rating.rating,
        gamesPlayed: rating.gamesPlayed,
      };
    } catch (error) {
      if (this.usersService.isNotFoundError(error)) {
        throw new RpcException({ code: GrpcStatus.NOT_FOUND, message: "USER_NOT_FOUND" });
      }
      throw error;
    }
  }
}
