import secrets
from concurrent.futures import ThreadPoolExecutor
import pytest
from fastapi.testclient import TestClient
from app.auth import hasher
from app.config import Settings
from app.main import create_app
from .conftest import ORIGIN


@pytest.fixture
def registration_app(tmp_path):
    app = create_app(Settings(data_dir=tmp_path,origin=ORIGIN))
    with TestClient(app) as client:
        yield client, app


def credentials(**changes):
    password = secrets.token_urlsafe(24)
    return {'username':'  owner  ','password':password,'password_confirmation':password,**changes}


def test_register_multiple_accounts_then_login(registration_app):
    client,app = registration_app
    data = credentials()
    assert client.get('/api/auth/registration').json() == {'available':True}
    response = client.post('/api/auth/register',json=data,headers={'origin':ORIGIN})
    assert response.status_code == 201
    assert response.json()['registered'] is True
    assert not client.cookies.get('session')
    with app.state.repo.connect() as conn:
        row = conn.execute('SELECT * FROM users').fetchone()
        assert row['id'] == 1 and row['username'] == 'owner'
        assert row['password_hash'] != data['password']
        assert hasher.verify(row['password_hash'],data['password'])
    assert client.get('/api/auth/registration').json() == {'available':True}
    response = client.post('/api/auth/register',json=credentials(username='other'),headers={'origin':ORIGIN})
    assert response.status_code == 201
    response = client.post('/api/auth/register',json=data,headers={'origin':ORIGIN})
    assert response.status_code == 409
    assert response.json()['code'] == 'USERNAME_TAKEN'
    assert client.post('/api/auth/login',json={'username':'owner','password':data['password']},headers={'origin':ORIGIN}).status_code == 200
    assert client.get('/api/auth/session').json()['username'] == 'owner'


@pytest.mark.parametrize('changes',[
    {'username':' '}, {'username':'x'*101}, {'password':'short','password_confirmation':'short'},
    {'password_confirmation':'different-password'}, {'password':'x'*1025,'password_confirmation':'x'*1025},
    {'unexpected':'field'},
])
def test_invalid_registration_does_not_create_owner_or_echo_password(registration_app,changes):
    client,app = registration_app
    data = credentials(**changes)
    result = client.post('/api/auth/register',json=data,headers={'origin':ORIGIN})
    assert result.status_code == 422
    assert data['password'] not in result.text
    assert 'password_hash' not in result.text
    assert client.get('/api/auth/registration').json()['available'] is True


def test_registration_origin_and_existing_owner(authorized):
    client,app = authorized
    assert client.post('/api/auth/register',json=credentials()).status_code == 403
    assert client.post('/api/auth/register',json=credentials(),headers={'origin':'https://evil.example'}).status_code == 403
    assert client.get('/api/auth/registration').json()['available'] is True
    assert client.post('/api/auth/register',json=credentials(username='another'),headers={'origin':ORIGIN}).status_code == 201


def test_racing_registrations_create_two_accounts_and_one_admin(registration_app):
    client,app = registration_app
    def submit(name):
        return client.post('/api/auth/register',json=credentials(username=name),headers={'origin':ORIGIN}).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(submit,['first','second']))
    assert sorted(results) == [201,201]
    with app.state.repo.connect() as conn:
        assert conn.execute('SELECT count(*) FROM users').fetchone()[0] == 2
        assert conn.execute('SELECT sum(is_admin) FROM users').fetchone()[0] == 1


def test_duplicate_racing_usernames_and_registration_limit(registration_app):
    client,app = registration_app
    data = credentials(username='same-name')
    def submit(_):
        return client.post('/api/auth/register',json=data,headers={'origin':ORIGIN}).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(submit,range(2))) == [201,409]
    for _ in range(8):
        assert submit(None) == 409
    assert submit(None) == 429
