"""Short-lived, one-use credentials for WebSockets on a separate hostname."""
import secrets
import threading
import time
from .auth import digest


class WebSocketTickets:
    def __init__(self, ttl=30, capacity=2048):
        self.ttl = ttl
        self.capacity = capacity
        self.entries = {}
        self.lock = threading.Lock()

    def issue(self, session):
        now = time.monotonic()
        with self.lock:
            self.entries = {key: value for key, value in self.entries.items() if value[1] > now}
            if len(self.entries) >= self.capacity:
                return None
            ticket = secrets.token_urlsafe(32)
            self.entries[digest(ticket)] = (session, now + self.ttl)
            return ticket

    def consume(self, ticket):
        with self.lock:
            entry = self.entries.pop(digest(ticket), None)
        return entry[0] if entry and entry[1] > time.monotonic() else None
