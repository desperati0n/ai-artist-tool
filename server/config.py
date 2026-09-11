import os
import re
import sys


def resource_dir(module_file=__file__, *, frozen=None, bundle_dir=None):
    """Return the read-only application resource root."""
    is_frozen = getattr(sys, "frozen", False) if frozen is None else frozen
    if is_frozen:
        packaged_root = bundle_dir if bundle_dir is not None else getattr(sys, "_MEIPASS", None)
        if packaged_root:
            return os.path.abspath(packaged_root)
    return os.path.dirname(os.path.dirname(os.path.abspath(module_file)))


BASE_DIR = resource_dir()


DEFAULT_PORT = 8010


def configured_port(environ=None):
    """Return the configured HTTP port, falling back to the project default."""
    values = os.environ if environ is None else environ
    return int(values.get("AI_ARTIST_PORT", str(DEFAULT_PORT)))


PORT = configured_port()


def configured_data_dir(environ=None, *, base_dir=BASE_DIR, frozen=None, executable=None):
    """Return a persistent archive directory beside the source tree or EXE."""
    values = os.environ if environ is None else environ
    override = values.get("AI_ARTIST_DATA_DIR")
    if override:
        return os.path.abspath(os.path.expanduser(os.path.expandvars(override)))

    is_frozen = getattr(sys, "frozen", False) if frozen is None else frozen
    if is_frozen:
        executable_path = sys.executable if executable is None else executable
        return os.path.abspath(os.path.join(os.path.dirname(executable_path), "data"))

    return os.path.abspath(os.path.join(base_dir, "data"))


DATA_DIR = configured_data_dir()


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
