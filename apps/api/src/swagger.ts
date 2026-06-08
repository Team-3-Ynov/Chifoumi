import type { INestApplication, NestMiddleware } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

export const SWAGGER_BEARER_AUTH = "JWT-auth";

type BasicAuthRequest = {
  headers: {
    authorization?: string;
  };
};

type BasicAuthResponse = {
  setHeader(name: string, value: string): void;
  status(statusCode: number): {
    send(body: string): void;
  };
};

type NextFunction = () => void;

export function buildSwaggerDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle("Chifoumi API")
    .setDescription(
      "API REST Chifoumi Ranked pour l'authentification, le profil joueur, l'historique de matchs et le leaderboard.",
    )
    .setVersion("1.0.0")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "RS256 access token returned by register/login. Paste only the token value.",
      },
      SWAGGER_BEARER_AUTH,
    )
    .build();

  return SwaggerModule.createDocument(app, config);
}

export function isSwaggerEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    Boolean(process.env.SWAGGER_USER && process.env.SWAGGER_PASSWORD)
  );
}

export function createSwaggerBasicAuthMiddleware(): NestMiddleware["use"] {
  return (req: BasicAuthRequest, res: BasicAuthResponse, next: NextFunction) => {
    if (process.env.NODE_ENV !== "production") {
      next();
      return;
    }

    const expectedUser = process.env.SWAGGER_USER;
    const expectedPassword = process.env.SWAGGER_PASSWORD;
    if (!expectedUser || !expectedPassword) {
      res.status(404).send("Swagger documentation is disabled");
      return;
    }

    const [scheme, credentials] = req.headers.authorization?.split(" ") ?? [];
    const decodedCredentials =
      scheme === "Basic" && credentials ? Buffer.from(credentials, "base64").toString("utf8") : "";
    const separatorIndex = decodedCredentials.indexOf(":");
    const user = decodedCredentials.slice(0, separatorIndex);
    const password = decodedCredentials.slice(separatorIndex + 1);

    if (user === expectedUser && password === expectedPassword) {
      next();
      return;
    }

    res.setHeader("WWW-Authenticate", 'Basic realm="Chifoumi Swagger"');
    res.status(401).send("Authentication required");
  };
}

export function setupSwagger(app: INestApplication): void {
  if (!isSwaggerEnabled()) {
    return;
  }

  app.use(["/api/docs", "/api/docs-json"], createSwaggerBasicAuthMiddleware());
  const document = buildSwaggerDocument(app);
  SwaggerModule.setup("api/docs", app, document, {
    jsonDocumentUrl: "api/docs-json",
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: "alpha",
      operationsSorter: "alpha",
    },
  });
}
