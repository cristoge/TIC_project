import boto3
import pytest
from botocore.stub import Stubber

from scripts.get_token import get_id_token, region_from_issuer


def test_region_comes_from_the_issuer():
    assert region_from_issuer("https://cognito-idp.eu-south-2.amazonaws.com/eu-south-2_AbC") == "eu-south-2"
    assert region_from_issuer("") is None
    assert region_from_issuer("https://example.com/pool") is None


def _client():
    return boto3.client("cognito-idp", region_name="eu-central-1")


def test_get_id_token_signs_in_with_email_and_password():
    client = _client()
    with Stubber(client) as stub:
        stub.add_response(
            "initiate_auth",
            {"AuthenticationResult": {"IdToken": "id-token", "AccessToken": "a", "RefreshToken": "r"}},
            expected_params={
                "ClientId": "client",
                "AuthFlow": "USER_PASSWORD_AUTH",
                "AuthParameters": {"USERNAME": "a@example.com", "PASSWORD": "secret"},
            },
        )

        assert get_id_token(client, "client", "a@example.com", "secret") == "id-token"


def test_a_pending_challenge_is_reported():
    client = _client()
    with Stubber(client) as stub:
        stub.add_response("initiate_auth", {"ChallengeName": "NEW_PASSWORD_REQUIRED", "Session": "s" * 20})

        with pytest.raises(RuntimeError, match="NEW_PASSWORD_REQUIRED"):
            get_id_token(client, "client", "a@example.com", "temporary")
