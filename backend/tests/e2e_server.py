"""Dedicated temporary database and random credentials; never touches local data/."""
import os
import logging
import tempfile
from pathlib import Path
import uvicorn
from app.auth import hasher
from app.config import Settings
from app.repository import Repository
from app.main import create_app

if __name__=='__main__':
    logging.getLogger('tracker').setLevel(logging.WARNING)
    password=os.environ['E2E_PASSWORD']
    with tempfile.TemporaryDirectory(prefix='paytrack-e2e-') as directory:
        settings=Settings(data_dir=Path(directory),origin='http://localhost:3000')
        repo=Repository(settings.db);repo.migrate()
        with repo.connect() as conn:
            conn.execute('INSERT INTO users(id,username,password_hash,is_admin) VALUES (1,?,?,1)',('e2e-owner',hasher.hash(password)))
            conn.commit()
        uvicorn.run(create_app(settings),host='127.0.0.1',port=int(os.environ.get('E2E_BACKEND_PORT','8000')),log_level='warning')
