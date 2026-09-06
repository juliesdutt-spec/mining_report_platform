"""
Authentication for DataForge.

The platform holds uploaded mining reports and, until now, served every one of
them to anyone who knew the URL. This module is what stands in front of that.

Two deliberate choices worth stating, because both look like omissions:

There is no signup endpoint. Accounts are seeded from the environment at
startup, so the set of people who can sign in is decided by whoever controls
the deployment, not by whoever finds the page. A public registration form on an
internal government tool would hand out exactly the access this module exists to
withhold.

Passwords are hashed with PBKDF2-HMAC-SHA256 from the standard library rather
than bcrypt or argon2. Both of those are native extensions that have to compile,
and a build failure here takes the whole service down - this project has already
lost a deploy to a package that needed a compiler. PBKDF2 with a high iteration
count is accepted by OWASP for password storage, and it costs no build step.
"""
import base64
import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt

# OWASP's floor for PBKDF2-HMAC-SHA256 is 600,000 iterations. Raising this later
# is safe: the count is stored in each hash, so existing passwords keep
# verifying against the value they were created with.
PBKDF2_ITERATIONS = 600_000
HASH_PREFIX = "pbkdf2_sha256"

TOKEN_ALGORITHM = "HS256"
TOKEN_TTL_HOURS = int(os.getenv("AUTH_TOKEN_TTL_HOURS", "12"))


def _secret() -> str:
    """
    The key that signs session tokens.

    Deliberately has no hardcoded fallback. A default baked into source would be
    public the moment the repository is read, and anyone could then mint a token
    for any user. When AUTH_SECRET is unset a random key is generated for this
    process instead: sessions stop working across a restart, which is a visible
    nuisance rather than a silent hole.
    """
    configured = os.getenv("AUTH_SECRET")
    if configured:
        return configured

    global _EPHEMERAL_SECRET
    if _EPHEMERAL_SECRET is None:
        _EPHEMERAL_SECRET = secrets.token_urlsafe(48)
        print(
            "AUTH_SECRET is not set. Using a key generated for this process, so "
            "everyone is signed out whenever the service restarts. Set "
            "AUTH_SECRET to a long random string to keep sessions across deploys."
        )
    return _EPHEMERAL_SECRET


_EPHEMERAL_SECRET: Optional[str] = None


def hash_password(password: str) -> str:
    """Hash a password for storage: prefix$iterations$salt$hash, all base64."""
    if not password:
        raise ValueError("password must not be empty")
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return "$".join([
        HASH_PREFIX,
        str(PBKDF2_ITERATIONS),
        base64.b64encode(salt).decode("ascii"),
        base64.b64encode(digest).decode("ascii"),
    ])


def verify_password(password: str, stored: str) -> bool:
    """
    Check a password against a stored hash.

    Returns False for anything malformed rather than raising, so a corrupted row
    fails the login instead of returning a 500 that tells an attacker the
    username exists.
    """
    if not password or not stored:
        return False
    try:
        prefix, iterations, salt_b64, expected_b64 = stored.split("$")
        if prefix != HASH_PREFIX:
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            base64.b64decode(salt_b64),
            int(iterations),
        )
    except (ValueError, TypeError):
        return False

    # Constant-time: a length-or-content comparison leaks how much of a guess
    # was correct through timing.
    return hmac.compare_digest(digest, base64.b64decode(expected_b64))


def create_access_token(username: str, *, readonly: bool = False) -> str:
    """Mint a signed session token for a username."""
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "sub": username,
            "readonly": readonly,
            "iat": now,
            "exp": now + timedelta(hours=TOKEN_TTL_HOURS),
        },
        _secret(),
        algorithm=TOKEN_ALGORITHM,
    )


def decode_access_token(token: str) -> Optional[dict]:
    """
    Read a session token, or None if it is not a valid, unexpired one.

    The algorithm is pinned to a single value. Letting the token's own header
    choose is how "alg: none" and HMAC-versus-RSA confusion attacks work - the
    caller would be trusting a value the attacker supplied.
    """
    if not token:
        return None
    try:
        return jwt.decode(token, _secret(), algorithms=[TOKEN_ALGORITHM])
    except jwt.PyJWTError:
        return None


def parse_seed_users(raw: str) -> list[dict]:
    """
    Read the AUTH_USERS variable into account definitions.

    Format, comma-separated:  username:password[:Display Name]
    A password may not contain a comma or a colon; the parser stops at the third
    colon so a display name may contain them.
    """
    accounts = []
    for entry in (raw or "").split(","):
        entry = entry.strip()
        if not entry:
            continue
        parts = entry.split(":", 2)
        if len(parts) < 2 or not parts[0].strip() or not parts[1]:
            print(f"Ignoring malformed AUTH_USERS entry: expected username:password, got {parts[0][:20]!r}")
            continue
        username = parts[0].strip().lower()
        accounts.append({
            "username": username,
            "password": parts[1],
            "display_name": (parts[2].strip() if len(parts) > 2 and parts[2].strip() else username),
        })
    return accounts
