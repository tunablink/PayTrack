import json
import secrets
import socket
import threading
import time
import httpx
import uvicorn
from websockets.sync.client import connect
from app.config import Settings
from app.main import create_app
from .conftest import ORIGIN


def test_real_tcp_websocket_reconnect(authorized):
    client,app=authorized
    token=client.cookies.get('session')
    listener=socket.socket()
    listener.bind(('127.0.0.1',0))
    port=listener.getsockname()[1]
    server=uvicorn.Server(uvicorn.Config(create_app(Settings(data_dir=app.state.repo.path.parent,origin=ORIGIN)),log_level='warning'))
    worker=threading.Thread(target=server.run,kwargs={'sockets':[listener]},daemon=True)
    worker.start()
    try:
        deadline=time.monotonic()+10
        while not server.started and time.monotonic()<deadline:
            worker.join(.01)
        assert server.started
        url=f'ws://127.0.0.1:{port}/ws'
        with connect(url,origin=ORIGIN,additional_headers={'Cookie':f'session={token}'}) as a,connect(url,origin=ORIGIN,additional_headers={'Cookie':f'session={token}'}) as b:
            for i,ws in enumerate((a,b)):
                ws.send(json.dumps({'requestId':str(i),'action':'system.ping','payload':{}}))
            assert json.loads(a.recv(timeout=2))['requestId']=='0'
            assert json.loads(b.recv(timeout=2))['requestId']=='1'
            a.send('not json')
            assert json.loads(a.recv(timeout=2))['error']['code']=='INVALID_JSON'
        with connect(url,origin=ORIGIN,additional_headers={'Cookie':f'session={token}'}) as reconnected:
            reconnected.send(json.dumps({'requestId':'again','action':'organization.list','payload':{}}))
            assert json.loads(reconnected.recv(timeout=2))['success']
    finally:
        server.should_exit=True
        worker.join(10)
        listener.close()
        assert not worker.is_alive()
