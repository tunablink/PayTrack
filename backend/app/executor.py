import logging
import sqlite3
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from .registry import DomainError

log = logging.getLogger('tracker.backup')


class BackupExecutor:
    def __init__(self, repository):
        self.repository = repository
        self.pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix='sqlite-backup')
        self.lock = threading.Lock()
        self.jobs = {}

    def start(self):
        with self.lock:
            if any(j['state'] in ('QUEUED','RUNNING') for j in self.jobs.values()):
                raise DomainError('BACKUP_BUSY', 'Một tác vụ sao lưu đang chạy.')
            if len(self.jobs) >= 100:
                self.jobs.pop(next(iter(self.jobs)))
            job_id = uuid.uuid4().hex
            self.jobs[job_id] = {'job_id':job_id, 'state':'QUEUED'}
        self.pool.submit(self._backup, job_id)
        return {'job_id':job_id, 'state':'QUEUED'}

    def _backup(self, job_id):
        log.info('backup job=%s thread=%s id=%s', job_id, threading.current_thread().name, threading.get_ident())
        with self.lock:
            self.jobs[job_id]['state'] = 'RUNNING'
        try:
            folder = self.repository.path.parent / 'backups'
            folder.mkdir(exist_ok=True)
            with self.repository.connect() as source:
                with sqlite3.connect(folder / f'{job_id}.sqlite3') as target:
                    source.backup(target, pages=256)
                    result = target.execute('PRAGMA integrity_check').fetchone()[0]
                    if result != 'ok':
                        raise RuntimeError('Backup integrity check failed')
            with self.lock:
                self.jobs[job_id].update(state='COMPLETED', filename=f'{job_id}.sqlite3')
        except Exception:
            log.exception('Backup failed job=%s', job_id)
            with self.lock:
                self.jobs[job_id].update(state='FAILED', message='Không thể tạo bản sao lưu. Kiểm tra dung lượng và quyền thư mục.')

    def status(self, job_id):
        with self.lock:
            if job_id not in self.jobs:
                raise DomainError('NOT_FOUND', 'Tác vụ không tồn tại hoặc backend đã khởi động lại.')
            return dict(self.jobs[job_id])

    def close(self):
        self.pool.shutdown(wait=True, cancel_futures=True)
