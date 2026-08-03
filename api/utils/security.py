import os
import time
from threading import Lock

from api.config.settings import (
    RATE_LIMIT_WINDOW_SECONDS,
    RATE_LIMIT_MAX_ATTEMPTS,
    RATE_LIMIT_BLOCK_SECONDS,
)


class RateLimiter:
    """Rate limiter en memoria por IP o identificador."""

    # Cada IP+codigo probado deja una entrada; sin barrido periódico los dicts
    # crecen indefinidamente porque _clean_old solo toca la clave en curso.
    SWEEP_EVERY_SECONDS = 300

    def __init__(self):
        self._lock = Lock()
        self._attempts = {}  # {key: [timestamps]}
        self._blocked = {}  # {key: blocked_until}
        self._last_sweep = time.time()

    def _clean_old(self, key: str):
        cutoff = time.time() - RATE_LIMIT_WINDOW_SECONDS
        if key in self._attempts:
            self._attempts[key] = [t for t in self._attempts[key] if t > cutoff]

    def _sweep(self):
        """Descarta claves sin intentos recientes ni bloqueo vigente."""
        ahora = time.time()
        if ahora - self._last_sweep < self.SWEEP_EVERY_SECONDS:
            return
        self._last_sweep = ahora
        cutoff = ahora - RATE_LIMIT_WINDOW_SECONDS
        self._attempts = {
            key: recientes
            for key, intentos in self._attempts.items()
            if (recientes := [t for t in intentos if t > cutoff])
        }
        self._blocked = {
            key: hasta for key, hasta in self._blocked.items() if hasta > ahora
        }

    def is_blocked(self, key: str) -> bool:
        with self._lock:
            if key in self._blocked:
                if time.time() < self._blocked[key]:
                    return True
                del self._blocked[key]
            return False

    def record_attempt(self, key: str) -> bool:
        """Registra un intento. Devuelve True si debe bloquearse."""
        with self._lock:
            self._sweep()
            if key in self._blocked and time.time() < self._blocked[key]:
                return True
            self._clean_old(key)
            attempts = self._attempts.setdefault(key, [])
            attempts.append(time.time())
            if len(attempts) >= RATE_LIMIT_MAX_ATTEMPTS:
                self._blocked[key] = time.time() + RATE_LIMIT_BLOCK_SECONDS
                return True
            return False

    def reset(self, key: str):
        with self._lock:
            self._attempts.pop(key, None)
            self._blocked.pop(key, None)


login_limiter = RateLimiter()


def get_client_key(handler, identifier: str = None) -> str:
    try:
        ip = handler.client_address[0]
    except Exception:
        ip = "127.0.0.1"
    return f"{ip}:{identifier or 'global'}"
