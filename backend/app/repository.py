import sqlite3
import uuid
from contextlib import contextmanager
from pathlib import Path

MIGRATIONS = [Path(__file__).parent.parent / 'migrations' / name for name in
              ('001_initial.sql','002_multiple_accounts.sql','003_organization_details.sql','004_payment_due_date.sql')]


class Repository:
    def __init__(self, path):
        self.path = Path(path)

    @contextmanager
    def connect(self):
        conn = sqlite3.connect(self.path, timeout=3)
        conn.row_factory = sqlite3.Row
        conn.create_function('casefold', 1, lambda value: value.casefold() if value else '', deterministic=True)
        conn.execute('PRAGMA foreign_keys=ON')
        conn.execute('PRAGMA busy_timeout=3000')
        try:
            yield conn
        finally:
            conn.close()

    def migrate(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as conn:
            conn.execute('PRAGMA journal_mode=WAL')
            version = conn.execute('PRAGMA user_version').fetchone()[0]
            for i, file in enumerate(MIGRATIONS, 1):
                if version < i:
                    if version == 1 and i == 2:
                        backup_dir = self.path.parent / 'backups'
                        backup_dir.mkdir(exist_ok=True)
                        backup_path = backup_dir / f'pre-migration-002-{uuid.uuid4().hex}.sqlite3'
                        with sqlite3.connect(backup_path) as backup:
                            conn.backup(backup)
                    conn.executescript('BEGIN IMMEDIATE;\n' + file.read_text(encoding='utf8') + f'\nPRAGMA user_version={i};\nCOMMIT;')
