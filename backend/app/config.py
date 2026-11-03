import os
from dataclasses import dataclass
from pathlib import Path


@dataclass
class Settings:
    data_dir: Path = Path(os.getenv('DATA_DIR', '../data')).resolve()
    origin: str = os.getenv('APP_ORIGIN', 'http://localhost:3000')
    secure: bool = os.getenv('COOKIE_SECURE', 'false').lower() == 'true'
    session_seconds: int = int(os.getenv('SESSION_SECONDS', '28800'))

    @property
    def db(self):
        return self.data_dir / 'tracker.sqlite3'
