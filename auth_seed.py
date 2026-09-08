"""
Creating the accounts that may sign in.

Runs at startup. There is no signup endpoint, so this is the only way an account
comes into existence, which keeps the decision about who gets in with whoever
controls the deployment's environment.
"""
import os

from database import SessionLocal, User
from auth import hash_password, parse_seed_users

# Published on the sign-in page so an evaluator can look at the platform without
# being handed credentials first. Because it is public, it is created read-only:
# it can read every document and ask every question, but cannot upload, delete
# or resolve. Override the password with DEMO_PASSWORD if you would rather it
# were not the documented one.
DEMO_USERNAME = os.getenv("DEMO_USERNAME", "demo").strip().lower()
DEMO_PASSWORD = os.getenv("DEMO_PASSWORD", "dataforge-demo")
DEMO_ENABLED = os.getenv("DEMO_ACCOUNT", "on").strip().lower() not in {"off", "false", "0", "no"}

# Seeding only ever adds, so removing a name from AUTH_USERS leaves the account
# working - which is how a typo'd username survives being corrected. Listing it
# here deletes it, which is the only way to close an account without direct
# database access.
#   AUTH_REMOVE_USERS=olduser,typo
REMOVE_USERS = [
    name.strip().lower()
    for name in os.getenv("AUTH_REMOVE_USERS", "").split(",")
    if name.strip()
]


def seed_users() -> dict:
    """
    Create the configured accounts if they are missing.

    Existing rows are left alone: re-running this must not reset a password
    someone has since changed, and every deploy runs it again.
    """
    created, skipped, removed = [], [], []
    wanted = parse_seed_users(os.getenv("AUTH_USERS", ""))

    # A name in both lists is a contradiction; keeping the account is the
    # recoverable reading, since deleting one cannot be undone from here.
    to_remove = [name for name in REMOVE_USERS
                 if not any(a["username"] == name for a in wanted)]
    for name in REMOVE_USERS:
        if name not in to_remove:
            print(f"{name!r} is in both AUTH_USERS and AUTH_REMOVE_USERS; keeping the account.")

    if DEMO_ENABLED and not any(a["username"] == DEMO_USERNAME for a in wanted):
        wanted.append({
            "username": DEMO_USERNAME,
            "password": DEMO_PASSWORD,
            "display_name": "Demo (read-only)",
            "readonly": True,
        })

    db = SessionLocal()
    try:
        for account in wanted:
            username = account["username"]
            if db.query(User).filter(User.username == username).first():
                skipped.append(username)
                continue
            db.add(User(
                username=username,
                password_hash=hash_password(account["password"]),
                display_name=account.get("display_name") or username,
                is_readonly=bool(account.get("readonly", False)),
            ))
            created.append(username)
        for name in to_remove:
            deleted = db.query(User).filter(User.username == name).delete()
            if deleted:
                removed.append(name)
        db.commit()

        total = db.query(User).count()
    finally:
        db.close()

    if created:
        print(f"Created account(s): {', '.join(created)}")
    if removed:
        print(f"Removed account(s): {', '.join(removed)}")
    if total == 0:
        # Worth shouting about: every protected endpoint will refuse everyone.
        print(
            "No accounts exist and none were configured. Nobody can sign in. "
            "Set AUTH_USERS=username:password:Display Name (comma-separated)."
        )
    return {"created": created, "existing": skipped, "removed": removed, "total": total}
