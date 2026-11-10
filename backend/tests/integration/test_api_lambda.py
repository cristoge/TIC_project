import json

from mangum import Mangum

from adapters.postgres.catalog import PostgresCatalog
from entrypoints.api.app import Container, create_app


def _event(path, claims):
    return {
        "resource": "/{proxy+}",
        "path": path,
        "httpMethod": "GET",
        "headers": {"Host": "api.example.com"},
        "multiValueHeaders": {},
        "queryStringParameters": None,
        "multiValueQueryStringParameters": None,
        "pathParameters": {"proxy": path.lstrip("/")},
        "stageVariables": None,
        "requestContext": {
            "resourcePath": "/{proxy+}",
            "httpMethod": "GET",
            "path": f"/prod{path}",
            "stage": "prod",
            "identity": {"sourceIp": "127.0.0.1"},
            "authorizer": {"claims": claims} if claims else None,
        },
        "body": None,
        "isBase64Encoded": False,
    }


def _handler(database):
    container = Container(catalog=PostgresCatalog(database), study=None, storage=None, queue=None)
    return Mangum(create_app(container), lifespan="off")


def test_user_comes_from_the_cognito_authorizer_claims_in_the_lambda_event(database):
    claims = {"sub": "00000000-0000-0000-0000-0000000000aa", "email": "carol@example.com"}

    response = _handler(database)(_event("/me", claims), None)

    assert response["statusCode"] == 200
    assert json.loads(response["body"]) == {"id": claims["sub"], "email": "carol@example.com", "name": None}


def test_request_without_authorizer_claims_is_rejected(database):
    response = _handler(database)(_event("/me", None), None)

    assert response["statusCode"] == 401
