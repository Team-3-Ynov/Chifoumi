export type GrpcClientConfig = {
  url: string;
  timeoutMs: number;
};

export function loadGrpcClientConfig(): GrpcClientConfig {
  return {
    url: process.env.API_GRPC_URL ?? "localhost:50051",
    timeoutMs: Number(process.env.API_GRPC_TIMEOUT_MS ?? 1000),
  };
}

export const GRPC_CLIENT_CONFIG = "GRPC_CLIENT_CONFIG";
