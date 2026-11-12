import os


def _env_bool(name, default=False):
    return os.getenv(name, str(default)).lower() in ("true", "1", "yes")


class Config:
    CLASSROOM_STORAGE_PATH = os.getenv("CLASSROOM_STORAGE_PATH", "/private-classroom")
    MAIL_SERVER = os.getenv("MAIL_SERVER", "smtp.gmail.com")
    MAIL_PORT = int(os.getenv("MAIL_PORT", "587"))
    MAIL_USE_TLS = _env_bool("MAIL_USE_TLS", True)
    MAIL_USE_SSL = _env_bool("MAIL_USE_SSL", False)
    MAIL_USERNAME = os.getenv("MAIL_USERNAME") or None
    MAIL_PASSWORD = os.getenv("MAIL_PASSWORD") or None
    MAIL_DEFAULT_SENDER = (
        os.getenv("MAIL_SENDER_NAME", "Staticlass"),
        os.getenv("MAIL_SENDER_EMAIL") or os.getenv("MAIL_USERNAME", ""),
    )
