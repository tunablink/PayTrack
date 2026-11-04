import argparse
import getpass
import sqlite3
from pathlib import Path
from .auth import hasher
from .config import Settings
from .repository import Repository


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('command',choices=['setup','backup','restore','seed'])
    parser.add_argument('--file')
    parser.add_argument('--username')
    parser.add_argument('--confirm-empty-demo',action='store_true')
    args = parser.parse_args()
    repo = Repository(Settings().db)
    if args.command == 'restore':
        if not args.file:
            parser.error('restore requires --file; stop backend first')
        source_path = Path(args.file).resolve()
        if source_path == repo.path.resolve() or not source_path.is_file():
            parser.error('Invalid backup path')
        if input('Backend must be stopped. Type RESTORE to overwrite database: ') != 'RESTORE':
            return
        repo.path.parent.mkdir(parents=True,exist_ok=True)
        with sqlite3.connect(f'{source_path.as_uri()}?mode=ro',uri=True) as source:
            if source.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                raise RuntimeError('Invalid backup')
            with sqlite3.connect(repo.path) as target:
                source.backup(target)
                target.execute('DELETE FROM sessions')
                target.commit()
        print('Restored; sessions revoked. Restart backend.')
        return
    repo.migrate()
    if args.command == 'setup':
        username = input('Owner username: ').strip()
        password = getpass.getpass('Password (at least 12 characters): ')
        if not username or len(username)>100 or len(password)<12 or len(password)>1024:
            raise SystemExit('Invalid username or password length')
        if password != getpass.getpass('Confirm password: '):
            raise SystemExit('Passwords differ')
        with repo.connect() as conn:
            conn.execute('BEGIN IMMEDIATE')
            if conn.execute('SELECT 1 FROM users').fetchone():
                raise SystemExit('Administrator already exists; register additional accounts through /register')
            conn.execute('INSERT INTO users(username,password_hash,is_admin) VALUES (?,?,1)',(username,hasher.hash(password)))
            conn.commit()
        print('Administrator created.')
    elif args.command == 'backup':
        if not args.file:
            parser.error('backup requires --file')
        target_path = Path(args.file).resolve()
        if target_path.exists():
            raise SystemExit('Backup destination must not already exist')
        target_path.parent.mkdir(parents=True,exist_ok=True)
        with repo.connect() as source, sqlite3.connect(target_path) as target:
            source.backup(target)
        print('Backup completed.')
    elif args.command == 'seed':
        if not args.confirm_empty_demo:
            raise SystemExit('Use --confirm-empty-demo on a demo database only')
        with repo.connect() as conn:
            accounts = conn.execute('SELECT id,username FROM users').fetchall()
            selected = next((r for r in accounts if r['username']==args.username),None) if args.username else (accounts[0] if len(accounts)==1 else None)
            if selected is None:
                raise SystemExit('Create an account first; when multiple accounts exist, supply --username for demo data')
            if conn.execute('SELECT 1 FROM organizations').fetchone():
                raise SystemExit('Database must contain no organizations')
            conn.execute("INSERT INTO organizations(id,name,notes,user_id) VALUES (1,'Đơn vị mẫu A','DỮ LIỆU DEMO',?),(2,'Đơn vị mẫu B','DỮ LIỆU DEMO',?)",(selected['id'],selected['id']))
            conn.execute("INSERT INTO payments(organization_id,description,quantity,unit_price,amount,work_date,status,user_id) VALUES (1,'Giảng dạy (DEMO)','20',200000,4000000,'2026-11-01','UNPAID',?),(2,'Chấm thi (DEMO)','50',30000,1500000,'2026-11-02','PAID',?)",(selected['id'],selected['id']))
            conn.commit()
        print('Demo data created explicitly.')


if __name__ == '__main__':
    main()
