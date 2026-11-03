import json
import secrets
import sqlite3
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
import pytest
from app.auth import digest
from app.config import Settings
from app.main import create_app
from app.registry import Registry
from app.schemas import Empty
from app.dispatcher import Dispatcher
from .conftest import ORIGIN,send,create_org,create_payment


def test_auth_origin_csrf_and_rate_limit(setup):
    client,app,password=setup
    assert client.get('/api/auth/session').status_code==401
    assert client.post('/api/auth/login',json={'username':'owner','password':password}).status_code==403
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect('/ws',headers={'origin':ORIGIN}): pass
    for _ in range(5):
        assert client.post('/api/auth/login',json={'username':'owner','password':'wrong'},headers={'origin':ORIGIN}).status_code==401
    assert client.post('/api/auth/login',json={'username':'owner','password':password},headers={'origin':ORIGIN}).status_code==429


def test_logout_and_expired_open_socket(authorized):
    client,app=authorized
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect('/ws',headers={'origin':'https://evil.example'}): pass
    with client.websocket_connect('/ws',headers={'origin':ORIGIN}) as ws:
        assert send(ws,'system.ping')['success']
        assert client.post('/api/auth/logout',headers={'origin':'https://evil.example'}).status_code==403
        assert client.post('/api/auth/logout',headers={'origin':ORIGIN}).status_code==200
        assert send(ws,'organization.list')['error']['code']=='UNAUTHORIZED'


def test_session_expiry(authorized):
    client,app=authorized
    with client.websocket_connect('/ws',headers={'origin':ORIGIN}) as ws:
        with app.state.repo.connect() as conn:
            conn.execute('UPDATE sessions SET expires=0');conn.commit()
        assert send(ws,'system.ping')['error']['code']=='UNAUTHORIZED'


def test_complete_business_flow(authorized):
    client,app=authorized
    with client.websocket_connect('/ws',headers={'origin':ORIGIN}) as ws:
        org=create_org(ws,'  Đại học A  ')
        assert org['name']=='Đại học A'
        payment=create_payment(ws,org['id'])['data']
        assert payment['amount']==4000000
        assert send(ws,'organization.delete',{'id':org['id'],'version':org['version']})['error']['code']=='ORGANIZATION_IN_USE'
        before=send(ws,'dashboard.summary')['data']['totals']
        assert before['total']==before['unpaid']==4000000 and before['paid']==0
        paid=send(ws,'payment.updateStatus',{'id':payment['id'],'version':1,'status':'PAID'})['data']
        assert paid['version']==2
        assert send(ws,'payment.updateStatus',{'id':payment['id'],'version':1,'status':'UNPAID'})['error']['code']=='CONFLICT'
        report=send(ws,'report.summary')['data']
        assert report['totals']['paid']==4000000 and report['totals']['unpaid']==0
        assert report==send(ws,'dashboard.summary')['data']
        updated=send(ws,'payment.update',{**{k:paid[k] for k in ('id','version','organization_id','description','quantity','unit_price','work_date','status')},'quantity':'1.005','unit_price':100})['data']
        assert updated['amount']==101
        assert send(ws,'payment.delete',{'id':updated['id'],'version':updated['version']})['success']
        assert send(ws,'organization.update',{'id':org['id'],'version':1,'name':'Tên mới','notes':'Ghi chú'})['success']
        assert send(ws,'organization.delete',{'id':org['id'],'version':2})['success']
        assert send(ws,'organization.list')['data']==[]


@pytest.mark.parametrize('change',[{'quantity':'0'},{'quantity':'-1'},{'quantity':'1.0001'},{'quantity':'NaN'},{'unit_price':1.5},{'unit_price':-1},{'unit_price':1000000000001},{'work_date':'2026-02-30'},{'description':' '},{'status':'PENDING'},{'organization_id':999},{'amount':1}])
def test_payment_validation(authorized,change):
    client,app=authorized
    with client.websocket_connect('/ws',headers={'origin':ORIGIN}) as ws:
        org=create_org(ws)
        assert not create_payment(ws,org['id'],**change)['success']
        assert send(ws,'payment.list')['data']['total']==0


def test_filters_pagination_and_totals(authorized):
    client,app=authorized
    with client.websocket_connect('/ws',headers={'origin':ORIGIN}) as ws:
        a=create_org(ws);b=create_org(ws,'Đơn vị B')
        for i in range(23):
            assert create_payment(ws,a['id'] if i<20 else b['id'],description=f'Công việc {i}',quantity='1',unit_price=100,status='PAID' if i%2 else 'UNPAID',work_date='2026-10-01' if i<10 else '2026-11-01')['success']
        result=send(ws,'payment.list',{'page':2,'page_size':20})['data']
        assert result['total']==23 and len(result['items'])==3
        assert send(ws,'payment.list',{'search':'việc 22'})['data']['total']==1
        assert send(ws,'payment.list',{'organization_id':b['id']})['data']['total']==3
        summary=send(ws,'dashboard.summary',{'start_date':'2026-11-01','end_date':'2026-11-30','status':'PAID'})['data']
        assert summary['totals']['count']==6 and summary['totals']['paid']==600
        assert summary['totals']['total']==summary['totals']['paid']+summary['totals']['unpaid']
        assert send(ws,'payment.list',{'start_date':'2026-12-01','end_date':'2026-01-01'})['error']['code']=='VALIDATION_ERROR'


def test_idempotency_malformed_multiple_clients(authorized):
    client,app=authorized
    with client.websocket_connect('/ws',headers={'origin':ORIGIN}) as a,client.websocket_connect('/ws',headers={'origin':ORIGIN}) as b:
        key=secrets.token_hex(16)
        first=send(a,'organization.create',{'name':'A'},key)
        assert send(b,'organization.create',{'name':'A'},key)['data']==first['data']
        assert len(send(a,'organization.list')['data'])==1
        assert send(b,'organization.create',{'name':'B'},key)['error']['code']=='IDEMPOTENCY_CONFLICT'
        a.send_json({'requestId':'x','action':'organization.create','payload':{'name':'B'}})
        assert a.receive_json()['error']['code']=='IDEMPOTENCY_REQUIRED'
        a.send_text('{bad');assert a.receive_json()['error']['code']=='INVALID_JSON'
        a.send_json([]);assert a.receive_json()['error']['code']=='VALIDATION_ERROR'
        assert send(a,'__import__')['error']['code']=='UNKNOWN_ACTION'
    with client.websocket_connect('/ws',headers={'origin':ORIGIN}) as ws:
        assert len(send(ws,'organization.list')['data'])==1


def test_concurrent_writers_and_busy(authorized):
    client,app=authorized
    token=client.cookies.get('session');dispatcher=app.state.dispatcher
    with client.websocket_connect('/ws',headers={'origin':ORIGIN}) as ws:
        org=create_org(ws)
    def update(name):
        return dispatcher.dispatch({'requestId':name,'action':'organization.update','payload':{'id':org['id'],'version':1,'name':name},'idempotencyKey':secrets.token_hex(16)},token)
    with ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(update,['A','B']))
    assert sum(r['success'] for r in results)==1
    assert next(r for r in results if not r['success'])['error']['code']=='CONFLICT'
    with app.state.repo.connect() as lock:
        lock.execute('BEGIN IMMEDIATE')
        assert update('C')['error']['code']=='DATABASE_BUSY'


def test_restart_backup_restore_and_foreign_key(authorized,tmp_path,caplog):
    client,app=authorized
    with client.websocket_connect('/ws',headers={'origin':ORIGIN}) as ws:
        org=create_org(ws)
        assert create_payment(ws,org['id'])['success']
        with app.state.repo.connect() as conn:
            with pytest.raises(sqlite3.IntegrityError):
                conn.execute('DELETE FROM organizations WHERE id=?',(org['id'],))
        caplog.set_level('INFO')
        job=send(ws,'backup.start')['data']
        deadline=time.monotonic()+10
        while time.monotonic()<deadline:
            status=send(ws,'backup.status',{'job_id':job['job_id']})['data']
            if status['state'] in ('COMPLETED','FAILED'):break
        assert status['state']=='COMPLETED'
        assert 'sqlite-backup' in caplog.text
        backup=app.state.repo.path.parent/'backups'/status['filename']
        restored=tmp_path/'restored.sqlite3'
        with sqlite3.connect(backup) as source,sqlite3.connect(restored) as target:
            source.backup(target)
            assert target.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
            assert target.execute('SELECT sum(amount) FROM payments').fetchone()[0]==4000000
    restarted=create_app(Settings(data_dir=app.state.repo.path.parent,origin=ORIGIN))
    with TestClient(restarted) as second:
        second.cookies.set('session',client.cookies.get('session'))
        assert second.get('/api/auth/session').status_code==200
        with second.websocket_connect('/ws',headers={'origin':ORIGIN}) as ws:
            assert send(ws,'dashboard.summary')['data']['totals']['total']==4000000


def test_registry_whitelist_reflection():
    registry=Registry()
    @registry.action('custom',Empty)
    def handler(ctx,payload):return {'ok':True}
    assert registry.actions['custom'].handler(None,Empty())=={'ok':True}
    with pytest.raises(ValueError):registry.action('custom',Empty)(handler)
    with pytest.raises(TypeError):
        @registry.action('wrong',Empty)
        def wrong(x):pass
