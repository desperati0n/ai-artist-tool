"""Start the local service; keep helper imports compatible with existing scripts."""
import os
import threading
from http.server import ThreadingHTTPServer

from server.config import BASE_DIR, DEFAULT_PORT, PORT, DATA_DIR, IMAGES_DIR, THUMBNAILS_DIR, DATA_FILE, MAX_PROXY_BYTES, MAX_IMAGE_BYTES, MAX_META_BYTES, MAX_ARCHIVE_BYTES, MAX_ARCHIVE_FILES, ALLOWED_PROXY_HOSTS, IMAGE_EXTENSIONS, SAFE_ID, PNG_STRIPPABLE_CHUNKS, THUMBNAIL_SIZE, THUMBNAIL_QUALITY, configured_port
from server.images import is_allowed_image_url, safe_image_id, detect_image_extension, strip_png_metadata, find_image_path, thumbnail_path, create_thumbnail, image_index, rebuild_missing_thumbnails
from server.archive import atomic_write_json, archive_status, create_archive, restore_archive_file
from server.routes import APIHandler, resolve_frontend_asset

if __name__ == "__main__":
    os.makedirs(IMAGES_DIR, exist_ok=True)
    os.makedirs(THUMBNAILS_DIR, exist_ok=True)
    threading.Thread(target=rebuild_missing_thumbnails, daemon=True, name="thumbnail-builder").start()
    print(f"AI Artist Tool server: http://localhost:{PORT}")
    print(f"Local archive directory: {DATA_DIR}")
    ThreadingHTTPServer(("localhost", PORT), APIHandler).serve_forever()
