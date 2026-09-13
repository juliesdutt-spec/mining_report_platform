"""
Per-account throttling for the endpoints that cost money.

`/query` reaches a language model on every call, and the read-only demo
account's credentials are published on the sign-in page on purpose - an
evaluator with no account still needs a way in. That combination means
anybody who opens the site can spend the project's API budget, indefinitely,
without signing up for anything.

Deliberately in-process and dependency-free. This is one Railway container,
so a shared store would be machinery without a second reader; the limiter
resets on redeploy and would not span replicas, and both of those are
acceptable for the thing it defends against - casual or accidental
repetition, not a determined attacker. If the service is ever scaled out,
this needs to move to Redis, and the comment on DEFAULTS says so.
"""
import os
import threading
import time
from collections import defaultdict, deque
from typing import Deque, Dict, Optional, Tuple


def _int_env(name: str, default: int) -> int:
    """An unparseable override falls back rather than crashing the process."""
    try:
        value = int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default
    return value if value > 0 else default


#: Calls allowed per account per window. The demo account is held tighter
#: because its password is public; a named account is someone who was given
#: access deliberately.
WINDOW_SECONDS = _int_env("QUERY_RATE_WINDOW_SECONDS", 3600)
LIMIT_PER_ACCOUNT = _int_env("QUERY_RATE_LIMIT", 60)
LIMIT_FOR_DEMO = _int_env("QUERY_RATE_LIMIT_DEMO", 15)


class RateLimiter:
    """A fixed-size sliding window of call times per key."""

    def __init__(self, limit: int, window_seconds: int):
        self.limit = limit
        self.window = window_seconds
        self._calls: Dict[str, Deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str, limit: Optional[int] = None) -> Tuple[bool, int, int]:
        """
        Record a call against `key`.

        Returns (allowed, remaining, retry_after_seconds). A refused call is
        not recorded, so a caller who keeps hammering a closed door does not
        push their own window further out.
        """
        ceiling = self.limit if limit is None else limit
        now = time.monotonic()
        cutoff = now - self.window

        with self._lock:
            calls = self._calls[key]
            while calls and calls[0] <= cutoff:
                calls.popleft()

            if len(calls) >= ceiling:
                retry_after = int(calls[0] + self.window - now) + 1
                return False, 0, max(retry_after, 1)

            calls.append(now)
            return True, ceiling - len(calls), 0

    def reset(self, key: Optional[str] = None) -> None:
        """Clear one key's history, or all of it. For tests and admin use."""
        with self._lock:
            if key is None:
                self._calls.clear()
            else:
                self._calls.pop(key, None)


query_limiter = RateLimiter(LIMIT_PER_ACCOUNT, WINDOW_SECONDS)


def limit_for(username: str, is_demo: bool) -> int:
    """The ceiling this account gets."""
    return LIMIT_FOR_DEMO if is_demo else LIMIT_PER_ACCOUNT
