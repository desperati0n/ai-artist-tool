import os
import re


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


DEFAULT_PORT = 8010


def configured_port(environ=None):
    """Return the configured HTTP port, falling back to the project default."""
    values = os.environ if environ is None else environ
    return int(values.get("AI_ARTIST_PORT", str(DEFAULT_PORT)))


PORT = configured_port()


DATA_DIR = os.path.abspath(os.environ.get("AI_ARTIST_DATA_DIR", os.path.join(BASE_DIR, "data")))


IMAGES_DIR = os.path.join(DATA_DIR, "images")


THUMBNAILS_DIR = os.path.join(DATA_DIR, "thumbnails")


DATA_FILE = os.path.join(DATA_DIR, "data.json")


MAX_PROXY_BYTES = 30 * 1024 * 1024


MAX_IMAGE_BYTES = 200 * 1024 * 1024


MAX_META_BYTES = 64 * 1024 * 1024


MAX_ARCHIVE_BYTES = 50 * 1024 * 1024 * 1024


MAX_ARCHIVE_FILES = 200_000


ALLOWED_PROXY_HOSTS = ("danbooru.donmai.us", "cdn.donmai.us")


IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif")


SAFE_ID = re.compile(r"^[A-Za-z0-9._-]{1,160}$")


PNG_STRIPPABLE_CHUNKS = {b"tEXt", b"zTXt", b"iTXt", b"eXIf", b"tIME"}


THUMBNAIL_SIZE = (420, 560)


THUMBNAIL_QUALITY = 84
