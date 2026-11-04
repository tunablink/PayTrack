import json
import secrets
import sqlite3
import time
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from app.auth import authenticated,digest,hasher
from app.config import Settings
from app.main import create_app
from app.repository import Repository
from .conftest import ORIGIN,send,create_org,create_payment
from .test_registration import credentials,registration_app


def test_account_data_isolation_and_idempotency(registration_app):
    first,app = registration_app
    second = TestClient(app)
    for client,name in [(first,'account-a'),(second,'account-b')]:
        data=credentials(username=name)
        assert client.post('/api/auth/register',json=data,headers={'origin':ORIGIN}).status_code==201
        assert client.post('/api/auth/login',json={'username':name,'password':data['password']},headers={'origin':ORIGIN}).status_code==200
    assert first.get('/api/auth/session').json()['is_admin'] is True
    assert second.get('/api/auth/session').json()['is_admin'] is False
    with first.websocket_connect('/ws',headers={'origin':ORIGIN}) as a,second.websocket_connect('/ws',headers={'origin':ORIGIN}) as b:
        key=secrets.token_hex(16)
        org_a=send(a,'organization.create',{'name':'Private A'},key)['data']
        org_b=send(b,'organization.create',{'name':'Private B'},key)['data']
        assert org_a['id']!=org_b['id']
        payment=create_payment(a,org_a['id'])['data']
        assert [o['name'] for o in send(b,'organization.list')['data']]==['Private B']
        assert send(b,'payment.list')['data']['total']==0
        assert send(b,'payment.list',{'organization_id':org_a['id']})['data']['items']==[]
        for action,payload in [
            ('organization.update',{'id':org_a['id'],'version':1,'name':'Stolen'}),
            ('organization.delete',{'id':org_a['id'],'version':1}),
            ('payment.updateStatus',{'id':payment['id'],'version':1,'status':'PAID'}),
            ('payment.delete',{'id':payment['id'],'version':1}),
            ('payment.update',{**{k:payment[k] for k in ('id','version','organization_id','description','quantity','unit_price','work_date','status')},'description':'Stolen'}),
        ]:
            result=send(b,action,payload)
            assert result['error']['code']=='NOT_FOUND'
        assert create_payment(b,org_a['id'])['error']['code']=='VALIDATION_ERROR'
        assert create_payment(b,org_b['id'],quantity='1',unit_price=500,work_date='2025-11-04')['success']
        assert send(a,'report.years')['data']==['2026']
        assert send(b,'report.years')['data']==['2025']
        for action in ('dashboard.summary','report.summary'):
            assert send(a,action)['data']['totals']['total']==4000000
            assert send(b,action)['data']['totals']['total']==500
        assert send(b,'backup.start')['error']['code']=='FORBIDDEN'
        assert send(b,'backup.status',{'job_id':'unknown-job'})['error']['code']=='FORBIDDEN'
        with app.state.repo.connect() as conn:
            user_b=conn.execute('SELECT id FROM users WHERE username=?',('account-b',)).fetchone()[0]
            with pytest.raises(sqlite3.IntegrityError):
                conn.execute("INSERT INTO payments(organization_id,description,quantity,unit_price,amount,work_date,status,user_id) VALUES (?,'Cross account','1',1,1,'2026-11-04','UNPAID',?)",(org_a['id'],user_b))


def test_login_switch_invalidates_previous_socket(registration_app):
    client,app=registration_app
    a=credentials(username='account-a');b=credentials(username='account-b')
    for data in (a,b):
        assert client.post('/api/auth/register',json=data,headers={'origin':ORIGIN}).status_code==201
    assert client.post('/api/auth/login',json={'username':a['username'],'password':a['password']},headers={'origin':ORIGIN}).status_code==200
    with client.websocket_connect('/ws',headers={'origin':ORIGIN}) as ws:
        assert client.post('/api/auth/login',json={'username':b['username'],'password':b['password']},headers={'origin':ORIGIN}).status_code==200
        assert client.get('/api/auth/session').json()['username']=='account-b'
        assert send(ws,'organization.list')['error']['code']=='UNAUTHORIZED'


def test_migration_preserves_legacy_account_data_and_session(tmp_path):
    path=tmp_path/'tracker.sqlite3'
    legacy_sql=(Path(__file__).parent.parent/'migrations/001_initial.sql').read_text(encoding='utf8')
    token=secrets.token_urlsafe(48);password_hash=hasher.hash(secrets.token_urlsafe(24))
    with sqlite3.connect(path) as conn:
        conn.executescript(legacy_sql+'\nPRAGMA user_version=1;')
        conn.execute('INSERT INTO owner VALUES (1,?,?)',('existing',password_hash))
        conn.execute('INSERT INTO sessions VALUES (?,?)',(digest(token),int(time.time())+3600))
        conn.execute("INSERT INTO organizations(id,name,notes,version) VALUES (7,'Legacy','Keep note',3)")
        conn.execute("INSERT INTO payments(id,organization_id,description,quantity,unit_price,amount,work_date,status,version) VALUES (9,7,'Legacy work','2',500,1000,'2026-11-04','PAID',4)")
        conn.execute('INSERT INTO idempotency VALUES (?,?,?,?)',('legacy-key','fingerprint',json.dumps({'id':7}),int(time.time())))
        conn.commit()
    repo=Repository(path);repo.migrate();repo.migrate()
    with repo.connect() as conn:
        user=conn.execute('SELECT * FROM users').fetchone()
        assert user['username']=='existing' and user['password_hash']==password_hash and user['is_admin']==1
        assert authenticated(conn,token)['id']==1
        assert conn.execute('SELECT user_id,version FROM organizations WHERE id=7').fetchone()[:]==(1,3)
        assert conn.execute('SELECT user_id,amount,version FROM payments WHERE id=9').fetchone()[:]==(1,1000,4)
        assert conn.execute('SELECT user_id FROM idempotency').fetchone()[0]==1
        assert conn.execute('PRAGMA foreign_key_check').fetchall()==[]
        assert conn.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
    backups=list((tmp_path/'backups').glob('pre-migration-002-*.sqlite3'))
    assert len(backups)==1
    with sqlite3.connect(backups[0]) as backup:
        assert backup.execute('PRAGMA user_version').fetchone()[0]==1
        assert backup.execute('SELECT username FROM owner').fetchone()[0]=='existing'
    with TestClient(create_app(Settings(data_dir=tmp_path,origin=ORIGIN))) as client:
        client.cookies.set('session',token)
        assert client.get('/api/auth/session').json()['username']=='existing'
        with client.websocket_connect('/ws',headers={'origin':ORIGIN}) as ws:
            assert send(ws,'dashboard.summary')['data']['totals']['paid']==1000
