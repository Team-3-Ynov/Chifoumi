import { generateKeyPairSync } from "node:crypto";
import { JwtService } from "@nestjs/jwt";
import { v4 as uuidv4 } from "uuid";

export const testJwtKeys = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

export async function issueTestAccessToken(input?: {
  userId?: string;
  displayName?: string;
  jti?: string;
  expiresIn?: number;
}): Promise<string> {
  const jwtService = new JwtService({
    privateKey: testJwtKeys.privateKey,
    publicKey: testJwtKeys.publicKey,
    signOptions: { algorithm: "RS256" },
  });

  return jwtService.signAsync(
    {
      sub: input?.userId ?? "11111111-1111-1111-1111-111111111111",
      role: "player",
      jti: input?.jti ?? uuidv4(),
      displayName: input?.displayName ?? "player1",
    },
    {
      algorithm: "RS256",
      expiresIn: input?.expiresIn ?? 60,
    },
  );
}
