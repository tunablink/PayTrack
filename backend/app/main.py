import asyncio
import json
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool
from .auth import authenticated, digest, login
from .config import Settings
from .dispatcher import Dispatcher
from .executor import BackupExecutor
from .registry import DomainError
from .repository import Repository
from .schemas import Login

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(threadName)s %(name)s %(message)s')
log = logging.getLogger('tracker')


def create_app(settings=None):
    settings = settings or Settings()
    repo = Repository(settings.db)

    @asynccontextmanager
    async def lifespan(app):
        await run_in_threadpool(repo.migrate)
        app.state.executor = BackupExecutor(repo)
        app.state.dispatcher = Dispatcher(repo, app.state.executor)
        yield
        await run_in_threadpool(app.state.executor.close)

    app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None)
    app.state.repo = repo

    @app.middleware('http')
    async def protect_origin(request: Request, call_next):
        if request.method not in ('GET','HEAD','OPTIONS') and request.headers.get('origin') != settings.origin:
            return JSONResponse({'message':'Origin không hợp lệ.'}, status_code=403)
        response = await call_next(request)
        response.headers['Cache-Control'] = 'no-store'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        return response

    @app.get('/api/health')
    def health():
        with repo.connect() as conn:
            conn.execute('SELECT 1').fetchone()
        return {'status':'ok'}

    @app.get('/api/auth/session')
    def session(request: Request):
        with repo.connect() as conn:
            if not authenticated(conn, request.cookies.get('session')):
                return JSONResponse({'authenticated':False}, status_code=401)
            owner = conn.execute('SELECT username FROM owner WHERE id=1').fetchone()
            return {'authenticated':True,'username':owner['username']}

    @app.post('/api/auth/login')
    def sign_in(payload: Login, request: Request, response: Response):
        try:
            # The reverse proxy overwrites X-Real-IP; backend port is private in production.
            ip = request.headers.get('x-real-ip') if settings.secure else request.client.host
            token = login(repo, payload.username,payload.password,ip or request.client.host,settings.session_seconds)
        except DomainError as exc:
            return JSONResponse({'message':exc.message},status_code=429 if exc.code=='RATE_LIMIT' else 401)
        response.set_cookie('session', token, httponly=True, secure=settings.secure, samesite='strict', max_age=settings.session_seconds, path='/')
        return {'authenticated':True}

    @app.post('/api/auth/logout')
    def sign_out(request: Request, response: Response):
        token = request.cookies.get('session','')
        with repo.connect() as conn:
            conn.execute('DELETE FROM sessions WHERE token_hash=?',(digest(token),))
            conn.commit()
        response.delete_cookie('session',path='/',secure=settings.secure,httponly=True,samesite='strict')
        return {'authenticated':False}

    @app.websocket('/ws')
    async def websocket(ws: WebSocket):
        if ws.headers.get('origin') != settings.origin:
            await ws.close(code=4403)
            return
        token = ws.cookies.get('session','')
        def valid_session():
            with repo.connect() as conn:
                return authenticated(conn,token)
        if not await run_in_threadpool(valid_session):
            await ws.close(code=4401)
            return
        await ws.accept()
        log.info('WebSocket connected')
        try:
            while True:
                try:
                    raw_text = await asyncio.wait_for(ws.receive_text(),timeout=30)
                except asyncio.TimeoutError:
                    if not await run_in_threadpool(valid_session):
                        await ws.close(code=4401)
                        break
                    continue
                if len(raw_text.encode()) > 32768:
                    await ws.close(code=1009)
                    break
                try:
                    raw = json.loads(raw_text)
                except json.JSONDecodeError:
                    await ws.send_json({'requestId':None,'success':False,'error':{'code':'INVALID_JSON','message':'Thông điệp JSON không hợp lệ.'}})
                    continue
                try:
                    result = await run_in_threadpool(app.state.dispatcher.dispatch,raw,token)
                except Exception:
                    log.exception('Action failed')
                    result = {'requestId':raw.get('requestId') if isinstance(raw,dict) else None,'success':False,'error':{'code':'INTERNAL_ERROR','message':'Không thể xử lý thao tác. Vui lòng tải lại dữ liệu.'}}
                await ws.send_json(result)
                if result.get('error',{}).get('code') == 'UNAUTHORIZED':
                    await ws.close(code=4401)
                    break
        except WebSocketDisconnect:
            pass
        finally:
            log.info('WebSocket disconnected')
    return app


app = create_app()
