"""Print a Cognito ID token for local testing of the API and the agent.

    export COGNITO_CLIENT_ID=$(terraform -chdir=../infra/auth output -raw app_client_id)
    TOKEN=$(uv run python -m scripts.get_token you@example.com)
    curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8000/me

The password is asked interactively (or read from COGNITO_PASSWORD), never passed as an argument.
"""

import argparse
import getpass
import os
import sys

import boto3
from botocore.exceptions import BotoCoreError, ClientError


def get_id_token(client, client_id: str, email: str, password: str) -> str:
    response = client.initiate_auth(
        ClientId=client_id,
        AuthFlow="USER_PASSWORD_AUTH",
        AuthParameters={"USERNAME": email, "PASSWORD": password},
    )
    if "AuthenticationResult" not in response:
        raise RuntimeError(f"Sign-in needs an extra step: {response.get('ChallengeName')}")
    return response["AuthenticationResult"]["IdToken"]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("email")
    parser.add_argument("--region", default=os.environ.get("AWS_REGION", "eu-central-1"))
    args = parser.parse_args()

    client_id = os.environ.get("COGNITO_CLIENT_ID")
    if not client_id:
        print("Set COGNITO_CLIENT_ID (terraform -chdir=infra/auth output -raw app_client_id).", file=sys.stderr)
        return 2
    password = os.environ.get("COGNITO_PASSWORD") or getpass.getpass("Password: ")

    try:
        token = get_id_token(boto3.client("cognito-idp", region_name=args.region), client_id, args.email, password)
    except (ClientError, BotoCoreError, RuntimeError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    print(token)
    return 0


if __name__ == "__main__":
    sys.exit(main())
