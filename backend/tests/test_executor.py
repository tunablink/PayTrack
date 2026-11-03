import threading
from contextlib import contextmanager
from .conftest import ORIGIN,send


def test_background_backup_keeps_websocket_responsive_and_handles_error(authorized,monkeypatch):
    client,app=authorized
    entered=threading.Event();release=threading.Event()
    original=app.state.repo.connect
    @contextmanager
    def blocked_io():
        # Block only the actual backup worker; requests retain their own connections.
        if threading.current_thread().name.startswith('sqlite-backup'):
            entered.set()
            if not release.wait(10):raise RuntimeError('Test release timeout')
            raise OSError('Simulated disk failure')
        with original() as conn:yield conn
    monkeypatch.setattr(app.state.repo,'connect',blocked_io)
    try:
        with client.websocket_connect('/ws',headers={'origin':ORIGIN}) as ws:
            job=send(ws,'backup.start')['data']
            assert entered.wait(5)
            assert send(ws,'system.ping')['data']['pong']
            assert send(ws,'backup.start')['error']['code']=='BACKUP_BUSY'
            release.set()
            # Executor shutdown joins the real I/O worker before status is asserted.
            app.state.executor.pool.shutdown(wait=True)
            result=send(ws,'backup.status',{'job_id':job['job_id']})['data']
            assert result['state']=='FAILED'
            assert 'Simulated disk failure' not in result['message']
    finally:
        release.set()
