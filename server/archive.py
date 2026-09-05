import json
import os
import shutil
import tempfile
import zipfile
from .config import DATA_DIR, DATA_FILE, IMAGES_DIR, IMAGE_EXTENSIONS, MAX_ARCHIVE_BYTES, MAX_ARCHIVE_FILES, MAX_META_BYTES, SAFE_ID, THUMBNAILS_DIR
from .images import create_thumbnail, detect_image_extension, image_index


def atomic_write_json(path, payload):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd, temp_path = tempfile.mkstemp(prefix=".metadata-", suffix=".tmp", dir=os.path.dirname(path))
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_path, path)
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


def archive_status():
    indexed_images = image_index()
    thumbnail_count = 0
    if os.path.isdir(THUMBNAILS_DIR):
        thumbnail_count = sum(1 for name in os.listdir(THUMBNAILS_DIR) if name.lower().endswith(".jpg"))
    return {
        "status": "ok",
        "localArchive": True,
        "initialized": os.path.isfile(DATA_FILE),
        "imageCount": len(indexed_images),
        "thumbnailCount": thumbnail_count,
        "dataDirectory": "data",
    }


def create_archive(archive_path, data_file=DATA_FILE, images_dir=IMAGES_DIR):
    """Create a complete, portable archive without loading images into memory."""
    if not os.path.isfile(data_file):
        raise FileNotFoundError("Local archive has not been initialized")
    with open(data_file, "r", encoding="utf-8") as handle:
        manifest = json.load(handle)
    if not isinstance(manifest, dict):
        raise ValueError("Local archive metadata must be a JSON object")
    for key in ("artists", "categories", "presets"):
        if key in manifest and not isinstance(manifest[key], list):
            raise ValueError(f"Local archive field must be an array: {key}")

    image_count = 0
    with zipfile.ZipFile(archive_path, "w", allowZip64=True) as archive:
        archive.write(data_file, "manifest.json", compress_type=zipfile.ZIP_DEFLATED)
        if os.path.isdir(images_dir):
            for name in sorted(os.listdir(images_dir)):
                image_path = os.path.join(images_dir, name)
                stem, extension = os.path.splitext(name)
                if not os.path.isfile(image_path) or extension.lower() not in IMAGE_EXTENSIONS:
                    continue
                if not SAFE_ID.fullmatch(stem):
                    raise ValueError(f"Unsafe local image filename: {name}")
                archive.write(image_path, f"images/{name}", compress_type=zipfile.ZIP_STORED)
                image_count += 1
    return {"artists": len(manifest.get("artists", [])), "images": image_count}


def restore_archive_file(archive_path, data_dir=DATA_DIR):
    """Validate and atomically restore an archive, rolling back on any failure."""
    data_dir = os.path.abspath(data_dir)
    parent_dir = os.path.dirname(data_dir)
    os.makedirs(parent_dir, exist_ok=True)
    stage_dir = tempfile.mkdtemp(prefix=".artist-manager-stage-", dir=parent_dir)
    backup_dir = None
    try:
        stage_images = os.path.join(stage_dir, "images")
        stage_thumbnails = os.path.join(stage_dir, "thumbnails")
        os.makedirs(stage_images, exist_ok=True)
        os.makedirs(stage_thumbnails, exist_ok=True)

        with zipfile.ZipFile(archive_path, "r", allowZip64=True) as archive:
            entries = archive.infolist()
            filenames = [entry.filename for entry in entries]
            if len(entries) > MAX_ARCHIVE_FILES:
                raise ValueError("Archive contains too many files")
            if len(filenames) != len(set(filenames)):
                raise ValueError("Archive contains duplicate paths")
            if sum(entry.file_size for entry in entries) > MAX_ARCHIVE_BYTES:
                raise ValueError("Expanded archive is too large")

            manifest_entry = next((entry for entry in entries if entry.filename == "manifest.json"), None)
            if not manifest_entry:
                raise ValueError("manifest.json is missing")
            if manifest_entry.file_size > MAX_META_BYTES:
                raise ValueError("manifest.json is too large")
            manifest = json.loads(archive.read(manifest_entry).decode("utf-8"))
            if not isinstance(manifest, dict):
                raise ValueError("Invalid manifest")
            for key in ("artists", "categories", "presets"):
                if key in manifest and not isinstance(manifest[key], list):
                    raise ValueError(f"Invalid manifest field: {key}")
            manifest.pop("_localArchive", None)
            manifest.setdefault("version", 14)
            atomic_write_json(os.path.join(stage_dir, "data.json"), manifest)

            image_count = 0
            for entry in entries:
                if entry.is_dir() or entry.filename == "manifest.json":
                    continue
                if not entry.filename.startswith("images/"):
                    raise ValueError(f"Unexpected archive entry: {entry.filename}")
                name = entry.filename.split("/", 1)[1]
                stem, extension = os.path.splitext(name)
                extension = extension.lower()
                if os.path.basename(name) != name or extension not in IMAGE_EXTENSIONS:
                    raise ValueError(f"Unsafe image entry: {entry.filename}")
                if not SAFE_ID.fullmatch(stem):
                    raise ValueError(f"Unsafe image id: {entry.filename}")
                target = os.path.join(stage_images, name)
                with archive.open(entry, "r") as source, open(target, "wb") as destination:
                    shutil.copyfileobj(source, destination, length=1024 * 1024)
                with open(target, "rb") as handle:
                    detected_extension = detect_image_extension(handle.read(32))
                expected_extension = ".jpg" if extension == ".jpeg" else extension
                if not detected_extension or detected_extension != expected_extension:
                    raise ValueError(f"Invalid image entry: {entry.filename}")
                create_thumbnail(target, stem, stage_thumbnails)
                image_count += 1

        if os.path.exists(data_dir):
            backup_dir = tempfile.mkdtemp(
                prefix=f".{os.path.basename(data_dir)}.restore-backup-",
                dir=parent_dir,
            )
            os.rmdir(backup_dir)
            os.replace(data_dir, backup_dir)
        try:
            os.replace(stage_dir, data_dir)
            stage_dir = None
        except Exception:
            if backup_dir and os.path.exists(backup_dir) and not os.path.exists(data_dir):
                os.replace(backup_dir, data_dir)
                backup_dir = None
            raise
        if backup_dir and os.path.exists(backup_dir):
            shutil.rmtree(backup_dir)
            backup_dir = None
        return {"artists": len(manifest.get("artists", [])), "images": image_count}
    finally:
        if stage_dir and os.path.exists(stage_dir):
            shutil.rmtree(stage_dir)
        if backup_dir and os.path.exists(backup_dir) and not os.path.exists(data_dir):
            os.replace(backup_dir, data_dir)
