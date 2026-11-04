import time
import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
from app.config import Settings
from app.main import create_app
from app.ws_tickets import WebSocketTickets
from .conftest import ORIGIN, send


def test_one_use_expiry_and_capacity(monkeypatch):
    store = WebSocketTickets(ttl=1, capacity=1)
    ticket = store.issue('session')
    assert store.issue('another') is None
    assert store.consume(ticket) == 'session'
    assert store.consume(ticket) is None
    ticket = store.issue('expired')
    now = time.monotonic()
    monkeypatch.setattr('app.ws_tickets.time.monotonic', lambda: now + 2)
    assert store.consume(ticket) is None
    assert store.issue('new')


def test_ticket_cross_hostname_session_and_logout(setup):
    original, app, password = setup
    settings = Settings(data_dir=app.state.repo.path.parent, origin=ORIGIN, ws_ticket_auth=True)
    with TestClient(create_app(settings)) as client:
        assert client.post('/api/auth/ws-ticket', headers={'origin': ORIGIN}).status_code == 401
        assert client.post('/api/auth/login', json={'username': 'owner', 'password': password}, headers={'origin': ORIGIN}).status_code == 200
        assert client.post('/api/auth/ws-ticket', headers={'origin': 'https://other.example'}).status_code == 403
        response = client.post('/api/auth/ws-ticket', headers={'origin': ORIGIN})
        assert response.headers['cache-control'] == 'no-store'
        ticket = response.json()['ticket']
        # A separate browser origin sends no cookie to the backend WebSocket.
        cookie = client.cookies.get('session')
        client.cookies.clear()
        with client.websocket_connect('/ws', headers={'origin': ORIGIN}, subprotocols=['paytrack', 'ticket.' + ticket]) as ws:
            assert ws.accepted_subprotocol == 'paytrack'
            assert send(ws, 'organization.list')['success']
        with pytest.raises(WebSocketDisconnect) as exc:
            with client.websocket_connect('/ws', headers={'origin': ORIGIN}, subprotocols=['paytrack', 'ticket.' + ticket]):
                pass
        assert exc.value.code == 4401
        client.cookies.set('session', cookie)
        ticket = client.post('/api/auth/ws-ticket', headers={'origin': ORIGIN}).json()['ticket']
        assert client.post('/api/auth/logout', headers={'origin': ORIGIN}).status_code == 200
        client.cookies.clear()
        with pytest.raises(WebSocketDisconnect) as exc:
            with client.websocket_connect('/ws', headers={'origin': ORIGIN}, subprotocols=['paytrack', 'ticket.' + ticket]):
                pass
        assert exc.value.code == 4401


def test_ticket_route_disabled_by_default(authorized):
    client, _ = authorized
    assert client.post('/api/auth/ws-ticket', headers={'origin': ORIGIN}).status_code == 404
