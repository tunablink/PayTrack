import hashlib
import json
import sqlite3
import time
from types import SimpleNamespace
from pydantic import ValidationError
from .auth import authenticated
from .registry import DomainError
from .schemas import Message
from .services import registry


class Dispatcher:
    def __init__(self, repository, executor):
        self.repository, self.executor = repository, executor

    def dispatch(self, raw, token):
        request_id = raw.get('requestId') if isinstance(raw, dict) else None
        if not isinstance(request_id, str) or len(request_id) > 100:
            request_id = None
        try:
            message = Message.model_validate(raw)
            action = registry.actions.get(message.action)
            if not action:
                raise DomainError('UNKNOWN_ACTION', 'Thao tác không được hỗ trợ.')
            payload = action.schema.model_validate(message.payload)
            if action.write and not message.idempotencyKey:
                raise DomainError('IDEMPOTENCY_REQUIRED', 'Thao tác ghi cần khóa chống trùng riêng.')
            with self.repository.connect() as conn:
                conn.execute('BEGIN IMMEDIATE' if action.write else 'BEGIN')
                user = authenticated(conn, token)
                if not user:
                    raise DomainError('UNAUTHORIZED', 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
                fingerprint = hashlib.sha256(json.dumps({'action':message.action,'payload':message.payload}, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
                if action.write:
                    cached = conn.execute('SELECT * FROM idempotency WHERE key=? AND user_id=?', (message.idempotencyKey,user['id'])).fetchone()
                    if cached:
                        if cached['fingerprint'] != fingerprint:
                            raise DomainError('IDEMPOTENCY_CONFLICT', 'Khóa chống trùng đã dùng cho nội dung khác.')
                        return {'requestId':message.requestId, 'success':True, 'data':json.loads(cached['result'])}
                data = action.handler(SimpleNamespace(conn=conn, executor=self.executor,user_id=user['id'],is_admin=bool(user['is_admin'])), payload)
                if action.write:
                    conn.execute('INSERT INTO idempotency(key,fingerprint,result,created_at,user_id) VALUES (?,?,?,?,?)', (message.idempotencyKey, fingerprint,json.dumps(data),int(time.time()),user['id']))
                conn.commit()
            return {'requestId':message.requestId, 'success':True, 'data':data}
        except ValidationError:
            error = DomainError('VALIDATION_ERROR', 'Dữ liệu không hợp lệ. Kiểm tra trường bắt buộc, giới hạn số, ngày và trạng thái.')
        except DomainError as exc:
            error = exc
        except sqlite3.OperationalError as exc:
            if 'locked' in str(exc).lower() or 'busy' in str(exc).lower():
                error = DomainError('DATABASE_BUSY', 'Dữ liệu đang được xử lý. Hãy tải lại và thử sau.')
            else:
                raise
        except sqlite3.IntegrityError:
            error = DomainError('CONSTRAINT_ERROR', 'Thao tác vi phạm ràng buộc dữ liệu.')
        return {'requestId':request_id,'success':False,'error':{'code':error.code,'message':error.message}}
