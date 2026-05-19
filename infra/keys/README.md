# JWT RSA keys (development)

Local development uses PEM files in this directory. **Never commit `jwt-private.pem`.**

## Generate dev key pair

From the repository root:

```bash
mkdir -p infra/keys
openssl genrsa -out infra/keys/jwt-private.pem 2048
openssl rsa -in infra/keys/jwt-private.pem -pubout -out infra/keys/jwt-public.pem
```

On Windows (PowerShell):

```powershell
New-Item -ItemType Directory -Force -Path infra\keys
openssl genrsa -out infra/keys/jwt-private.pem 2048
openssl rsa -in infra/keys/jwt-private.pem -pubout -out infra/keys/jwt-public.pem
```

Copy `JWT_*` variables from `.env.example` into your local `.env` if needed.

## Production

Production does **not** use files on disk. Set PEM content via environment variables:

- `JWT_PRIVATE_KEY` — full RSA private key PEM string
- `JWT_PUBLIC_KEY` — full RSA public key PEM string

Access and refresh TTLs are configured with `JWT_ACCESS_TTL_SECONDS` and `JWT_REFRESH_TTL_SECONDS`.
