import secrets
import pytest
from fastapi.testclient import TestClient
from app.auth import hasher
from app.config import Settings
from app.main import create_app

ORIGIN = 'http://localhost:3000'


@pytest.fixture
def setup(tmp_path):
    settings = Settings(data_dir=tmp_path,origin=ORIGIN)
    app = create_app(settings)
    with TestClient(app) as client:
        password = secrets.token_urlsafe(24)
        with app.state.repo.connect() as conn:
            conn.execute('INSERT INTO owner VALUES (1,?,?)',('owner',hasher.hash(password)))
            conn.commit()
        yield client,app,password


@pytest.fixture
def authorized(setup):
    client,app,password=setup
    assert client.post('/api/auth/login',json={'username':'owner','password':password},headers={'origin':ORIGIN}).status_code==200
    return client,app


def send(ws,action,payload=None,key=None):
    request_id=secrets.token_hex(8)
    ws.send_json({'requestId':request_id,'action':action,'payload':payload or {},'idempotencyKey':key or secrets.token_hex(16)})
    result=ws.receive_json()
    assert result['requestId']==request_id
    return result


def create_org(ws,name='Đơn vị A'):
    return send(ws,'organization.create',{'name':name})['data']


def create_payment(ws,org_id,**changes):
    return send(ws,'payment.create',{'organization_id':org_id,'description':'Giảng dạy','quantity':'20','unit_price':200000,'work_date':'2026-11-02','status':'UNPAID',**changes})
