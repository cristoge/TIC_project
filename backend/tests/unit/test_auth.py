import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from entrypoints.api.auth import InvalidToken, JwtVerifier, user_from_api_gateway_event

ISSUER = "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_TEST"
CLIENT_ID = "app-client"
PRIVATE_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


class FakeJwksClient:
    def get_signing_key_from_jwt(self, token):
        class Key:
            key = PRIVATE_KEY.public_key()

        return Key()


def _token(**overrides):
    claims = {
        "sub": "user-1",
        "email": "a@example.com",
        "iss": ISSUER,
        "aud": CLIENT_ID,
        "token_use": "id",
        "exp": int(time.time()) + 300,
    }
    claims.update(overrides)
    return jwt.encode(claims, PRIVATE_KEY, algorithm="RS256", headers={"kid": "k1"})


def _verifier():
    return JwtVerifier(issuer=ISSUER, client_id=CLIENT_ID, jwks_client=FakeJwksClient())


def test_valid_id_token_gives_the_user():
    user = _verifier().verify(_token())

    assert (user.id, user.email) == ("user-1", "a@example.com")


@pytest.mark.parametrize(
    "overrides",
    [
        {"aud": "another-client"},
        {"iss": "https://example.com"},
        {"exp": int(time.time()) - 10},
        {"token_use": "access"},
    ],
)
def test_invalid_tokens_are_rejected(overrides):
    with pytest.raises(InvalidToken):
        _verifier().verify(_token(**overrides))


def test_user_comes_from_the_api_gateway_authorizer_claims():
    event = {"requestContext": {"authorizer": {"claims": {"sub": "user-1", "email": "a@example.com"}}}}

    user = user_from_api_gateway_event(event)

    assert (user.id, user.email) == ("user-1", "a@example.com")


def test_missing_authorizer_claims_are_rejected():
    with pytest.raises(InvalidToken):
        user_from_api_gateway_event({"requestContext": {}})
