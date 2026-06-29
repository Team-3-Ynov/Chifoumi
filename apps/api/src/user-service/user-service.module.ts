import { AUTH_PROTO_PACKAGE, AUTH_PROTO_PATH } from "@chifoumi/proto";
import { Global, Module } from "@nestjs/common";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { USER_SERVICE_GRPC_CLIENT, UserService } from "./user.service.js";

@Global()
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: USER_SERVICE_GRPC_CLIENT,
        useFactory: () => ({
          transport: Transport.GRPC,
          options: {
            package: AUTH_PROTO_PACKAGE,
            protoPath: AUTH_PROTO_PATH,
            url: process.env.USER_SERVICE_GRPC_URL ?? "localhost:50053",
          },
        }),
      },
    ]),
  ],
  providers: [UserService],
  exports: [UserService],
})
export class UserServiceModule {}
