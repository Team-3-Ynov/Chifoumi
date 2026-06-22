import { Controller } from "@nestjs/common";
import { GrpcMethod } from "@nestjs/microservices";
import { AuthVerificationService } from "./auth-verification.service.js";

@Controller()
export class AuthGrpcController {
  constructor(private readonly authVerificationService: AuthVerificationService) {}

  @GrpcMethod("Auth", "VerifyToken")
  async verifyToken(data: { token: string }) {
    const result = await this.authVerificationService.verifyToken(data.token);
    return {
      valid: result.valid,
      userId: result.userId ?? "",
      role: result.role ?? "",
      displayName: result.displayName ?? "",
      reason: result.reason ?? "",
      jti: result.jti ?? "",
    };
  }
}
