import os
import sqlite3
import subprocess
import sys
from app.repository import Repository


def test_cli_backup_and_restore_revokes_sessions(tmp_path):
    repo=Repository(tmp_path/'tracker.sqlite3');repo.migrate()
    with repo.connect() as conn:
        conn.execute("INSERT INTO organizations(name) VALUES ('Trước backup')")
        conn.execute("INSERT INTO sessions VALUES ('digest',9999999999)")
        conn.commit()
    backup=tmp_path/'snapshot.sqlite3'
    env={**os.environ,'DATA_DIR':str(tmp_path),'PYTHONUTF8':'1'}
    result=subprocess.run([sys.executable,'-m','app.cli','backup','--file',str(backup)],env=env,capture_output=True,text=True)
    assert result.returncode==0,result.stderr
    with repo.connect() as conn:
        conn.execute("UPDATE organizations SET name='Sau backup'");conn.commit()
    result=subprocess.run([sys.executable,'-m','app.cli','restore','--file',str(backup)],env=env,input='RESTORE\n',capture_output=True,text=True)
    assert result.returncode==0,result.stderr
    with repo.connect() as conn:
        assert conn.execute('SELECT name FROM organizations').fetchone()[0]=='Trước backup'
        assert conn.execute('SELECT count(*) FROM sessions').fetchone()[0]==0
        assert conn.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
