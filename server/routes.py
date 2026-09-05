import json
import mimetypes
import os
import shutil
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from .config import BASE_DIR, DATA_FILE, IMAGES_DIR, IMAGE_EXTENSIONS, MAX_ARCHIVE_BYTES, MAX_IMAGE_BYTES, MAX_META_BYTES, MAX_PROXY_BYTES
from .images import create_thumbnail, detect_image_extension, find_image_path, image_index, is_allowed_image_url, safe_image_id, strip_png_metadata, thumbnail_path
from .archive import archive_status, atomic_write_json, create_archive, restore_archive_file


def resolve_frontend_asset(request_path, build_dir=None):
    """Resolve only the Vite entry and its generated assets inside dist/."""
    root = os.path.abspath(build_dir or os.path.join(BASE_DIR, "dist"))
    decoded = urllib.parse.unquote(request_path)
    if decoded == "/react.html":
        relative = "react.html"
    elif decoded.startswith("/assets/"):
        relative = decoded.lstrip("/")
    else:
        return None
    if any(part in ("", ".", "..") for part in relative.replace("\\", "/").split("/")):
        return None
    candidate = os.path.abspath(os.path.join(root, relative))
    if os.path.commonpath((root, candidate)) != root or not os.path.isfile(candidate):
        return None
    return candidate


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
        if parsed.path == "/":
            self.redirect_to_frontend()
            return
        if parsed.path == "/react.html" or parsed.path.startswith("/assets/"):
            self.serve_frontend_asset(parsed.path, head_only=True)
            return
        if parsed.path.startswith("/api/thumbnail/"):
            self.serve_thumbnail_by_id(parsed.path.rsplit("/", 1)[-1], head_only=True)
            return
        if parsed.path.startswith("/api/image/"):
            self.serve_image_by_id(parsed.path.rsplit("/", 1)[-1], head_only=True)
            return
        super().do_HEAD()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/":
            self.redirect_to_frontend()
            return
        if parsed.path == "/react.html" or parsed.path.startswith("/assets/"):
            self.serve_frontend_asset(parsed.path)
            return
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

    def redirect_to_frontend(self):
        self.send_response(302)
        self.send_header("Location", "/react.html")
        self.send_header("Content-Length", "0")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

    def serve_frontend_asset(self, request_path, head_only=False):
        asset_path = resolve_frontend_asset(request_path)
        if not asset_path:
            self.send_error(503, "React build is unavailable; run npm run build first")
            return
        size = os.path.getsize(asset_path)
        mime = mimetypes.guess_type(asset_path)[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(size))
        self.send_header("Cache-Control", "no-store" if request_path == "/react.html" else "public, max-age=31536000, immutable")
        self.end_headers()
        if not head_only:
            with open(asset_path, "rb") as handle:
                shutil.copyfileobj(handle, self.wfile)

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
