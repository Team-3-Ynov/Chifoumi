import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

export const SWAGGER_BEARER_AUTH = "JWT-auth";

export function buildSwaggerDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle("Chifoumi API")
    .setVersion("0.1.0")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "RS256 access token from register/login",
      },
      SWAGGER_BEARER_AUTH,
    )
    .build();

  return SwaggerModule.createDocument(app, config);
}

export function setupSwagger(app: INestApplication): void {
  const document = buildSwaggerDocument(app);
  SwaggerModule.setup("api/docs", app, document);
}
