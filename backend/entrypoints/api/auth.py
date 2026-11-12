"""Who is calling. The user id is always the Cognito `sub`, never a value from the URL or body.

The ID token is validated here against the user pool's public keys (JWKS).
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
            claims = jwt.decode(
                token,
                key,
                algorithms=["RS256"],
                audience=self.client_id,
                issuer=self.issuer,
                # PyJWT only checks a claim when it is present unless it is required here.
                options={"require": ["exp", "iss", "aud", "sub", "email", "token_use"]},
            )
        except jwt.PyJWTError as error:
            raise InvalidToken(str(error)) from error
        if claims.get("token_use") != "id":
            raise InvalidToken("An ID token is required.")
        return CurrentUser(id=claims["sub"], email=claims["email"])


def get_current_user(request: Request) -> CurrentUser:
    verifier: JwtVerifier | None = request.app.state.jwt_verifier
    try:
        if verifier is None:
            raise InvalidToken("No token verifier configured.")
        scheme, _, token = request.headers.get("authorization", "").partition(" ")
        if scheme.lower() != "bearer" or not token:
            raise InvalidToken("Missing bearer token.")
        return verifier.verify(token)
    except InvalidToken as error:
        raise HTTPException(status_code=401, detail="Not authenticated.") from error
