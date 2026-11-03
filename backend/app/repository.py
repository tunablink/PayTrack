import sqlite3
from contextlib import contextmanager
from pathlib import Path

MIGRATIONS = [Path(__file__).parent.parent / 'migrations' / '001_initial.sql']


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
                    conn.executescript('BEGIN IMMEDIATE;\n' + file.read_text(encoding='utf8') + f'\nPRAGMA user_version={i};\nCOMMIT;')
