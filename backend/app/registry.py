import inspect
import logging
import time
from dataclasses import dataclass
from functools import wraps

log = logging.getLogger('tracker.actions')


class DomainError(Exception):
    def __init__(self, code, message):
        self.code, self.message = code, message
        super().__init__(message)


@dataclass
class Action:
    schema: type
    handler: object
    write: bool


class Registry:
    def __init__(self):
        self.actions = {}

    def action(self, name, schema, write=False):
        def register(fn):
            if name in self.actions:
                raise ValueError(f'Duplicate action: {name}')
            if list(inspect.signature(fn).parameters) != ['ctx', 'payload']:
                raise TypeError('Handler signature must be (ctx, payload)')

            @wraps(fn)
            def measured(ctx, payload):
                start = time.monotonic()
                try:
                    return fn(ctx, payload)
                finally:
                    log.info('action=%s duration_ms=%.2f', name, (time.monotonic()-start)*1000)
            self.actions[name] = Action(schema, measured, write)
            return measured
        return register
