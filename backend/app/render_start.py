"""Render entrypoint: optional one-time SQLite import before the server starts."""
import os
import sqlite3
import uuid
from contextlib import closing
from pathlib import Path
from .config import Settings
from .repository import Repository, MIGRATIONS


def import_database_once(repo, source_path):
    source_path = Path(source_path).resolve()
    if not source_path.is_file():
        return None
    if source_path == repo.path.resolve():
        raise RuntimeError('Import source must differ from the live database.')
    with closing(sqlite3.connect(f'{source_path.as_uri()}?mode=ro', uri=True)) as source:
        tables = {row[0] for row in source.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        version = source.execute('PRAGMA user_version').fetchone()[0]
        if source.execute('PRAGMA integrity_check').fetchone()[0] != 'ok' or not {'organizations', 'payments', 'sessions'} <= tables or not tables.intersection({'users', 'owner'}) or not 1 <= version <= len(MIGRATIONS):
            raise RuntimeError('Invalid PayTrack database import.')
        repo.migrate()
        folder = repo.path.parent / 'backups'
        folder.mkdir(exist_ok=True)
        backup_path = folder / f'pre-render-import-{uuid.uuid4().hex}.sqlite3'
        with repo.connect() as target:
            with closing(sqlite3.connect(backup_path)) as backup:
                target.backup(backup)
            source.backup(target)
            target.execute('DELETE FROM sessions')
            target.commit()
    repo.migrate()
    imported = source_path.with_name(source_path.name + '.imported')
    if imported.exists():
        imported = source_path.with_name(source_path.name + f'.{uuid.uuid4().hex}.imported')
    source_path.rename(imported)
    return backup_path


def main():
    settings = Settings()
    source = os.getenv('IMPORT_DATABASE_ONCE')
    if source:
        result = import_database_once(Repository(settings.db), source)
        print('SQLite import completed; old sessions revoked.' if result else 'No pending SQLite import.', flush=True)
    os.execvp('uvicorn', ['uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', os.getenv('PORT', '10000'), '--workers', '1', '--ws-max-size', '32768'])


if __name__ == '__main__':
    main()
