import hashlib
import secrets
import time
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, InvalidHashError
from .registry import DomainError

hasher = PasswordHasher()


def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()


def authenticated(conn, token):
    return bool(token and conn.execute('SELECT 1 FROM sessions WHERE token_hash=? AND expires>?', (digest(token), int(time.time()))).fetchone())


def login(repo, username, password, ip, ttl):
    now = int(time.time())
    with repo.connect() as conn:
        conn.execute('BEGIN IMMEDIATE')
        attempt = conn.execute('SELECT * FROM login_attempts WHERE ip=?', (ip,)).fetchone()
        if attempt and attempt['reset_at'] > now and attempt['count'] >= 5:
            raise DomainError('RATE_LIMIT', 'Thử đăng nhập quá nhiều. Vui lòng chờ 15 phút.')
        row = conn.execute('SELECT * FROM owner WHERE id=1').fetchone()
        # Verify an Argon2 hash even when the username is wrong.
        valid = False
        if row:
            try:
                valid = hasher.verify(row['password_hash'], password) and row['username'] == username
            except (VerificationError, InvalidHashError):
                pass
        if not valid:
            count = attempt['count']+1 if attempt and attempt['reset_at'] > now else 1
            conn.execute('INSERT OR REPLACE INTO login_attempts VALUES (?,?,?)', (ip, count, attempt['reset_at'] if attempt and attempt['reset_at'] > now else now+900))
            conn.commit()
            raise DomainError('AUTH_FAILED', 'Tên đăng nhập hoặc mật khẩu không đúng.')
        conn.execute('DELETE FROM login_attempts WHERE ip=?', (ip,))
        conn.execute('DELETE FROM sessions WHERE expires<=?', (now,))
        token = secrets.token_urlsafe(48)
        conn.execute('INSERT INTO sessions VALUES (?,?)', (digest(token), now+ttl))
        conn.commit()
        return token
