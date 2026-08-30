import json
import mimetypes
import os
import re
import shutil
import struct
import tempfile
import threading
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from PIL import Image, ImageOps


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("AI_ARTIST_PORT", "8000"))
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


def is_allowed_image_url(raw_url):
    try:
        parsed = urllib.parse.urlparse(raw_url)
        host = (parsed.hostname or "").lower()
        return parsed.scheme == "https" and any(host == item or host.endswith("." + item) for item in ALLOWED_PROXY_HOSTS)
    except Exception:
        return False


def safe_image_id(raw_id):
    image_id = urllib.parse.unquote(str(raw_id or ""))
    return image_id if SAFE_ID.fullmatch(image_id) else None


def detect_image_extension(header):
    if header.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if header.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if header.startswith((b"GIF87a", b"GIF89a")):
        return ".gif"
    if len(header) >= 12 and header[:4] == b"RIFF" and header[8:12] == b"WEBP":
        return ".webp"
    if len(header) >= 12 and header[4:8] == b"ftyp" and b"avif" in header[8:32]:
        return ".avif"
    return None


def strip_png_metadata(path):
    """Remove non-visual PNG metadata without recompressing pixel data."""
    fd, output_path = tempfile.mkstemp(prefix=".png-clean-", suffix=".tmp", dir=os.path.dirname(path))
    removed = 0
    try:
        with open(path, "rb") as source, os.fdopen(fd, "wb") as output:
            signature = source.read(8)
            if signature != b"\x89PNG\r\n\x1a\n":
                raise ValueError("Invalid PNG signature")
            output.write(signature)
            while True:
                length_bytes = source.read(4)
                if not length_bytes:
                    raise ValueError("PNG is missing IEND")
                if len(length_bytes) != 4:
                    raise ValueError("Truncated PNG chunk")
                length = struct.unpack(">I", length_bytes)[0]
                chunk_type = source.read(4)
                chunk_data = source.read(length)
                crc = source.read(4)
                if len(chunk_type) != 4 or len(chunk_data) != length or len(crc) != 4:
                    raise ValueError("Truncated PNG chunk")
                if chunk_type in PNG_STRIPPABLE_CHUNKS:
                    removed += 12 + length
                else:
                    output.write(length_bytes)
                    output.write(chunk_type)
                    output.write(chunk_data)
                    output.write(crc)
                if chunk_type == b"IEND":
                    break
            output.flush()
            os.fsync(output.fileno())
        os.replace(output_path, path)
        return removed
    finally:
        if os.path.exists(output_path):
            os.remove(output_path)


def find_image_path(image_id, root=IMAGES_DIR):
    if not image_id:
        return None
    for extension in IMAGE_EXTENSIONS:
        candidate = os.path.join(root, image_id + extension)
        if os.path.isfile(candidate):
            return candidate
    return None


def thumbnail_path(image_id, root=THUMBNAILS_DIR):
    return os.path.join(root, image_id + ".jpg")


def create_thumbnail(source_path, image_id, root=THUMBNAILS_DIR):
    """Create a small display copy while leaving the archived original untouched."""
    os.makedirs(root, exist_ok=True)
    fd, temp_path = tempfile.mkstemp(prefix=".thumbnail-", suffix=".jpg", dir=root)
    os.close(fd)
    target_path = thumbnail_path(image_id, root)
    try:
        with Image.open(source_path) as opened:
            image = ImageOps.exif_transpose(opened)
            image.thumbnail(THUMBNAIL_SIZE, Image.Resampling.LANCZOS)
            if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
                rgba = image.convert("RGBA")
                flattened = Image.new("RGB", rgba.size, "white")
                flattened.paste(rgba, mask=rgba.getchannel("A"))
                image = flattened
            elif image.mode != "RGB":
                image = image.convert("RGB")
            image.save(
                temp_path,
                format="JPEG",
                quality=THUMBNAIL_QUALITY,
                subsampling=1,
                optimize=True,
                progressive=True,
            )
        os.replace(temp_path, target_path)
        return target_path
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


def image_index(root=IMAGES_DIR):
    result = {}
    if not os.path.isdir(root):
        return result
    for name in os.listdir(root):
        path = os.path.join(root, name)
        stem, extension = os.path.splitext(name)
        if os.path.isfile(path) and extension.lower() in IMAGE_EXTENSIONS and SAFE_ID.fullmatch(stem):
            result[stem] = int(os.path.getmtime(path) * 1000)
    return result


def rebuild_missing_thumbnails(image_root=IMAGES_DIR, thumbnail_root=THUMBNAILS_DIR):
    os.makedirs(thumbnail_root, exist_ok=True)
    created = 0
    failed = []
    for image_id in image_index(image_root):
        source_path = find_image_path(image_id, image_root)
        target_path = thumbnail_path(image_id, thumbnail_root)
        if os.path.isfile(target_path) and os.path.getmtime(target_path) >= os.path.getmtime(source_path):
            continue
        try:
            create_thumbnail(source_path, image_id, thumbnail_root)
            created += 1
        except Exception as error:
            failed.append({"id": image_id, "error": str(error)})
    return {"created": created, "failed": failed}


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


class APIHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def send_json(self, data, status=200):
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(payload)

    def read_json_payload(self, limit=MAX_META_BYTES):
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > limit:
            raise ValueError("Payload is empty or too large")
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def do_HEAD(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path.startswith("/api/thumbnail/"):
            self.serve_thumbnail_by_id(parsed.path.rsplit("/", 1)[-1], head_only=True)
            return
        if parsed.path.startswith("/api/image/"):
            self.serve_image_by_id(parsed.path.rsplit("/", 1)[-1], head_only=True)
            return
        super().do_HEAD()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/status":
            self.send_json(archive_status())
            return
        if parsed.path == "/api/danbooru-image":
            self.proxy_danbooru_image(parsed)
            return
        if parsed.path == "/api/load":
            self.load_archive()
            return
        if parsed.path.startswith("/api/image/"):
            self.serve_image_by_id(parsed.path.rsplit("/", 1)[-1])
            return
        if parsed.path.startswith("/api/thumbnail/"):
            self.serve_thumbnail_by_id(parsed.path.rsplit("/", 1)[-1])
            return
        if parsed.path == "/api/export":
            self.export_archive()
            return
        super().do_GET()

    def load_archive(self):
        data = {"version": 14, "artists": [], "categories": [], "presets": [], "theme": "light"}
        initialized = os.path.isfile(DATA_FILE)
        if initialized:
            try:
                with open(DATA_FILE, "r", encoding="utf-8") as handle:
                    data = json.load(handle)
            except Exception as error:
                self.send_json({"error": f"Error reading metadata: {error}"}, 500)
                return
        indexed_images = image_index()
        data["_localArchive"] = {
            "initialized": initialized,
            "imageCount": len(indexed_images),
            "thumbnailCount": archive_status()["thumbnailCount"],
            "imageIndex": indexed_images,
        }
        self.send_json(data)

    def serve_image_by_id(self, raw_id, head_only=False):
        image_id = safe_image_id(raw_id)
        image_path = find_image_path(image_id)
        if not image_id or not image_path:
            self.send_error(404, "Image not found")
            return
        self.serve_local_file(image_path, head_only)

    def serve_thumbnail_by_id(self, raw_id, head_only=False):
        image_id = safe_image_id(raw_id)
        source_path = find_image_path(image_id)
        if not image_id or not source_path:
            self.send_error(404, "Image not found")
            return
        target_path = thumbnail_path(image_id)
        try:
            if not os.path.isfile(target_path) or os.path.getmtime(target_path) < os.path.getmtime(source_path):
                create_thumbnail(source_path, image_id)
        except Exception as error:
            self.send_error(500, f"Unable to create thumbnail: {error}")
            return
        self.serve_local_file(target_path, head_only)

    def serve_local_file(self, image_path, head_only=False):
        mime = mimetypes.guess_type(image_path)[0] or "application/octet-stream"
        size = os.path.getsize(image_path)
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(size))
        self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        if not head_only:
            with open(image_path, "rb") as handle:
                shutil.copyfileobj(handle, self.wfile, length=1024 * 1024)

    def proxy_danbooru_image(self, parsed):
        target = urllib.parse.parse_qs(parsed.query).get("url", [""])[0]
        if not target or not is_allowed_image_url(target):
            self.send_json({"error": "Only Danbooru HTTPS image URLs are allowed"}, 400)
            return
        try:
            request = urllib.request.Request(target, headers={
                "User-Agent": "AI-Artist-Tool/1.0",
                "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                "Referer": "https://danbooru.donmai.us/",
            })
            with urllib.request.urlopen(request, timeout=30) as response:
                content_type = response.headers.get_content_type() or "image/jpeg"
                if not content_type.startswith("image/"):
                    self.send_json({"error": "Danbooru response is not an image"}, 502)
                    return
                data = response.read(MAX_PROXY_BYTES + 1)
            if len(data) > MAX_PROXY_BYTES:
                self.send_json({"error": "Image is too large"}, 413)
                return
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Cache-Control", "no-store")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except urllib.error.HTTPError as error:
            self.send_json({"error": f"Danbooru HTTP {error.code}"}, 502)
        except Exception as error:
            self.send_json({"error": f"Proxy error: {error}"}, 502)

    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        if not parsed.path.startswith("/api/image/"):
            self.send_json({"error": "API endpoint not found"}, 404)
            return
        image_id = safe_image_id(parsed.path.rsplit("/", 1)[-1])
        if not image_id:
            self.send_json({"error": "Invalid image id"}, 400)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_IMAGE_BYTES:
            self.send_json({"error": "Image is empty or too large"}, 413)
            return
        os.makedirs(IMAGES_DIR, exist_ok=True)
        fd, temp_path = tempfile.mkstemp(prefix=".image-", suffix=".tmp", dir=IMAGES_DIR)
        removed_metadata = 0
        try:
            remaining = length
            with os.fdopen(fd, "wb") as handle:
                while remaining:
                    chunk = self.rfile.read(min(1024 * 1024, remaining))
                    if not chunk:
                        raise ValueError("Image upload ended early")
                    handle.write(chunk)
                    remaining -= len(chunk)
                handle.flush()
                os.fsync(handle.fileno())
            with open(temp_path, "rb") as handle:
                extension = detect_image_extension(handle.read(32))
            if not extension:
                raise ValueError("Unsupported or invalid image format")
            if extension == ".png" and self.headers.get("X-Strip-Metadata") == "1":
                removed_metadata = strip_png_metadata(temp_path)
            created = find_image_path(image_id) is None
            for old_extension in IMAGE_EXTENSIONS:
                old_path = os.path.join(IMAGES_DIR, image_id + old_extension)
                if os.path.exists(old_path):
                    os.remove(old_path)
            final_path = os.path.join(IMAGES_DIR, image_id + extension)
            os.replace(temp_path, final_path)
            create_thumbnail(final_path, image_id)
            version = int(os.path.getmtime(final_path) * 1000)
            self.send_json({
                "success": True,
                "url": f"/api/image/{urllib.parse.quote(image_id)}?v={version}",
                "thumbnailUrl": f"/api/thumbnail/{urllib.parse.quote(image_id)}?v={version}",
                "version": version,
                "bytes": os.path.getsize(final_path),
                "format": extension.lstrip("."),
                "metadataBytesRemoved": removed_metadata,
                "created": created,
            })
        except ValueError as error:
            self.send_json({"error": str(error)}, 400)
        except Exception as error:
            self.send_json({"error": f"Unable to save image: {error}"}, 500)
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        if not parsed.path.startswith("/api/image/"):
            self.send_json({"error": "API endpoint not found"}, 404)
            return
        image_id = safe_image_id(parsed.path.rsplit("/", 1)[-1])
        if not image_id:
            self.send_json({"error": "Invalid image id"}, 400)
            return
        deleted = False
        for extension in IMAGE_EXTENSIONS:
            image_path = os.path.join(IMAGES_DIR, image_id + extension)
            if os.path.exists(image_path):
                os.remove(image_path)
                deleted = True
        preview_path = thumbnail_path(image_id)
        if os.path.exists(preview_path):
            os.remove(preview_path)
        self.send_json({"success": True, "deleted": deleted})

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/import-archive":
            self.import_archive()
            return
        if parsed.path != "/api/save-meta":
            self.send_json({"error": "API endpoint not found"}, 404)
            return
        try:
            payload = self.read_json_payload()
            if not isinstance(payload, dict):
                raise ValueError("Metadata must be a JSON object")
            payload.pop("_localArchive", None)
            payload.setdefault("version", 14)
            atomic_write_json(DATA_FILE, payload)
            self.send_json({"success": True})
        except (ValueError, json.JSONDecodeError) as error:
            self.send_json({"error": str(error)}, 400)
        except Exception as error:
            self.send_json({"error": f"Unable to save metadata: {error}"}, 500)

    def export_archive(self):
        fd, zip_path = tempfile.mkstemp(prefix="artist-manager-", suffix=".zip")
        os.close(fd)
        try:
            create_archive(zip_path)
            size = os.path.getsize(zip_path)
            filename = f"artist_manager_backup_{datetime.now().strftime('%Y-%m-%d_%H%M%S')}.zip"
            self.send_response(200)
            self.send_header("Content-Type", "application/zip")
            self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
            self.send_header("Content-Length", str(size))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            with open(zip_path, "rb") as handle:
                shutil.copyfileobj(handle, self.wfile, length=1024 * 1024)
        except FileNotFoundError as error:
            self.send_json({"error": str(error)}, 404)
        except (ValueError, json.JSONDecodeError) as error:
            self.send_json({"error": str(error)}, 400)
        except Exception as error:
            self.send_json({"error": f"Unable to export archive: {error}"}, 500)
        finally:
            if os.path.exists(zip_path):
                os.remove(zip_path)

    def import_archive(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_ARCHIVE_BYTES:
            self.send_json({"error": "Archive is empty or too large"}, 413)
            return
        fd, upload_path = tempfile.mkstemp(prefix="artist-manager-import-", suffix=".zip")
        os.close(fd)
        try:
            remaining = length
            with open(upload_path, "wb") as handle:
                while remaining:
                    chunk = self.rfile.read(min(1024 * 1024, remaining))
                    if not chunk:
                        raise ValueError("Archive upload ended early")
                    handle.write(chunk)
                    remaining -= len(chunk)
            result = restore_archive_file(upload_path)
            self.send_json({"success": True, **result})
        except (ValueError, json.JSONDecodeError, zipfile.BadZipFile) as error:
            self.send_json({"error": str(error)}, 400)
        except Exception as error:
            self.send_json({"error": f"Unable to import archive: {error}"}, 500)
        finally:
            if os.path.exists(upload_path):
                os.remove(upload_path)


if __name__ == "__main__":
    os.makedirs(IMAGES_DIR, exist_ok=True)
    os.makedirs(THUMBNAILS_DIR, exist_ok=True)
    threading.Thread(target=rebuild_missing_thumbnails, daemon=True, name="thumbnail-builder").start()
    print(f"AI Artist Tool server: http://localhost:{PORT}")
    print(f"Local archive directory: {DATA_DIR}")
    ThreadingHTTPServer(("localhost", PORT), APIHandler).serve_forever()
