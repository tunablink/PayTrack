import sqlite3
from contextlib import closing
import pytest
from app.render_start import import_database_once
from app.repository import Repository
from .conftest import create_org, create_payment, ORIGIN


def test_import_preserves_data_revokes_sessions_and_runs_once(authorized, tmp_path):
    client, app = authorized
    with client.websocket_connect('/ws', headers={'origin': ORIGIN}) as ws:
        org = create_org(ws)
        create_payment(ws, org['id'], due_date='2026-12-01')
    source_path = tmp_path / 'import.sqlite3'
    with app.state.repo.connect() as source, closing(sqlite3.connect(source_path)) as destination:
        source.backup(destination)
    repo = Repository(tmp_path / 'render' / 'tracker.sqlite3')
    backup = import_database_once(repo, source_path)
    assert backup.is_file()
    assert not source_path.exists()
    assert source_path.with_name(source_path.name + '.imported').is_file()
    with repo.connect() as conn:
        assert conn.execute('SELECT count(*) FROM sessions').fetchone()[0] == 0
        assert conn.execute('SELECT username FROM users').fetchone()[0] == 'owner'
        assert conn.execute('SELECT due_date FROM payments').fetchone()[0] == '2026-12-01'
        conn.execute("UPDATE organizations SET name='After deployment'")
        conn.commit()
    assert import_database_once(repo, source_path) is None
    with repo.connect() as conn:
        assert conn.execute('SELECT name FROM organizations').fetchone()[0] == 'After deployment'
        assert conn.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'


def test_invalid_import_does_not_replace_database(tmp_path):
    source = tmp_path / 'bad.sqlite3'
    with closing(sqlite3.connect(source)) as conn:
        conn.execute('CREATE TABLE unrelated (id INTEGER)')
    target = tmp_path / 'tracker.sqlite3'
    with pytest.raises(RuntimeError, match='Invalid PayTrack'):
        import_database_once(Repository(target), source)
    assert not target.exists() and source.exists()
