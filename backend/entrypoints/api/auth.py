"""Who is calling. The user id is always the Cognito `sub`, never a value from the URL or body.

- In AWS, API Gateway's Cognito authorizer has already validated the ID token;
  the claims arrive in the Lambda event (Mangum exposes it as scope["aws.event"]).
- Locally there is no API Gateway, so the ID token is validated here against
  the user pool's public keys (JWKS).
"""

from dataclasses import dataclass

import jwt
from fastapi import HTTPException, Request


@dataclass(frozen=True)
class CurrentUser:
    id: str
    email: str


class InvalidToken(Exception):
    pass


class JwtVerifier:
    def __init__(self, issuer: str, client_id: str, jwks_client=None):
        self.issuer = issuer
        self.client_id = client_id
        self.jwks_client = jwks_client or jwt.PyJWKClient(f"{issuer}/.well-known/jwks.json")

    def verify(self, token: str) -> CurrentUser:
        try:
            key = self.jwks_client.get_signing_key_from_jwt(token).key
            claims = jwt.decode(token, key, algorithms=["RS256"], audience=self.client_id, issuer=self.issuer)
        except jwt.PyJWTError as error:
            raise InvalidToken(str(error)) from error
        if claims.get("token_use") != "id":
            raise InvalidToken("An ID token is required.")
        return CurrentUser(id=claims["sub"], email=claims["email"])


def user_from_api_gateway_event(event: dict | None) -> CurrentUser:
    try:
        claims = event["requestContext"]["authorizer"]["claims"]
        return CurrentUser(id=claims["sub"], email=claims["email"])
    except (KeyError, TypeError) as error:
        raise InvalidToken("No authorizer claims in the request.") from error


def get_current_user(request: Request) -> CurrentUser:
    verifier: JwtVerifier | None = request.app.state.jwt_verifier
    try:
        if verifier is None:
            return user_from_api_gateway_event(request.scope.get("aws.event"))
        scheme, _, token = request.headers.get("authorization", "").partition(" ")
        if scheme.lower() != "bearer" or not token:
            raise InvalidToken("Missing bearer token.")
        return verifier.verify(token)
    except InvalidToken as error:
        raise HTTPException(status_code=401, detail="Not authenticated.") from error
