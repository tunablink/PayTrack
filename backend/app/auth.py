import hashlib
import sqlite3
import secrets
import time
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, InvalidHashError
from .registry import DomainError

hasher = PasswordHasher()
dummy_hash = hasher.hash(secrets.token_urlsafe(32))


def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()


def authenticated(conn, token):
    if not token:
        return None
    row = conn.execute('SELECT u.id,u.username,u.is_admin FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires>?', (digest(token),int(time.time()))).fetchone()
    return dict(row) if row else None


def registration_available(repo):
    return True


def register_account(repo, username, password, ip):
    now = int(time.time())
    # Reserve a rate-limit attempt before expensive password hashing.
    with repo.connect() as conn:
        conn.execute('BEGIN IMMEDIATE')
        attempt = conn.execute('SELECT * FROM registration_attempts WHERE ip=?',(ip,)).fetchone()
        if attempt and attempt['reset_at'] > now and attempt['count'] >= 10:
            raise DomainError('RATE_LIMIT','Đăng ký quá nhiều lần. Vui lòng chờ 15 phút.')
        count = attempt['count']+1 if attempt and attempt['reset_at'] > now else 1
        reset = attempt['reset_at'] if attempt and attempt['reset_at'] > now else now+900
        conn.execute('INSERT OR REPLACE INTO registration_attempts VALUES (?,?,?)',(ip,count,reset))
        conn.commit()
        if conn.execute('SELECT 1 FROM users WHERE username=?',(username,)).fetchone():
            raise DomainError('USERNAME_TAKEN','Tên đăng nhập đã được sử dụng. Vui lòng chọn tên khác.')
    password_hash = hasher.hash(password)
    with repo.connect() as conn:
        conn.execute('BEGIN IMMEDIATE')
        first = conn.execute('SELECT 1 FROM users LIMIT 1').fetchone() is None
        try:
            conn.execute('INSERT INTO users(username,password_hash,is_admin) VALUES (?,?,?)',(username,password_hash,int(first)))
        except sqlite3.IntegrityError:
            raise DomainError('USERNAME_TAKEN','Tên đăng nhập đã được sử dụng. Vui lòng chọn tên khác.') from None
        conn.commit()


def login(repo, username, password, ip, ttl, previous_token=None):
    now = int(time.time())
    with repo.connect() as conn:
        conn.execute('BEGIN IMMEDIATE')
        attempt = conn.execute('SELECT * FROM login_attempts WHERE ip=?', (ip,)).fetchone()
        if attempt and attempt['reset_at'] > now and attempt['count'] >= 5:
            raise DomainError('RATE_LIMIT', 'Thử đăng nhập quá nhiều. Vui lòng chờ 15 phút.')
        row = conn.execute('SELECT * FROM users WHERE username=?', (username,)).fetchone()
        # Verify an Argon2 hash even when the username is wrong.
        valid = False
        try:
            verified = hasher.verify(row['password_hash'] if row else dummy_hash, password)
            valid = bool(row and verified)
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
        conn.execute('INSERT INTO sessions(token_hash,expires,user_id) VALUES (?,?,?)', (digest(token), now+ttl,row['id']))
        if previous_token:
            conn.execute('DELETE FROM sessions WHERE token_hash=?',(digest(previous_token),))
        conn.commit()
        return token
