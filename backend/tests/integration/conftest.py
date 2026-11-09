import os
import uuid

import psycopg
import pytest

from adapters.postgres.migrations import apply_migrations

ADMIN_URL = os.environ.get("TEST_DATABASE_URL", "postgresql://study:study@localhost:5433/study")


@pytest.fixture
def empty_database():
    """A fresh, empty database per test; dropped afterwards."""
    name = f"test_{uuid.uuid4().hex}"
    with psycopg.connect(ADMIN_URL, autocommit=True) as admin:
        admin.execute(f'create database "{name}"')
    conninfo = psycopg.conninfo.make_conninfo(ADMIN_URL, dbname=name)
    try:
        yield conninfo
    finally:
        with psycopg.connect(ADMIN_URL, autocommit=True) as admin:
            admin.execute(f'drop database "{name}" with (force)')


@pytest.fixture
def database(empty_database):
    """A fresh database with every migration applied."""
    apply_migrations(empty_database)
    return empty_database


@pytest.fixture
def conn(database):
    with psycopg.connect(database, autocommit=True) as connection:
        yield connection
