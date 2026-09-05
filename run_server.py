"""Start the local service; keep helper imports compatible with existing scripts."""
import os
import threading
import argparse
import webbrowser
from http.server import ThreadingHTTPServer

from server.config import BASE_DIR, DEFAULT_PORT, PORT, DATA_DIR, IMAGES_DIR, THUMBNAILS_DIR, DATA_FILE, MAX_PROXY_BYTES, MAX_IMAGE_BYTES, MAX_META_BYTES, MAX_ARCHIVE_BYTES, MAX_ARCHIVE_FILES, ALLOWED_PROXY_HOSTS, IMAGE_EXTENSIONS, SAFE_ID, PNG_STRIPPABLE_CHUNKS, THUMBNAIL_SIZE, THUMBNAIL_QUALITY, configured_port
from server.images import is_allowed_image_url, safe_image_id, detect_image_extension, strip_png_metadata, find_image_path, thumbnail_path, create_thumbnail, image_index, rebuild_missing_thumbnails
from server.archive import atomic_write_json, archive_status, create_archive, restore_archive_file
from server.routes import APIHandler, resolve_frontend_asset

def main(*, open_browser=True, port=PORT):
    os.makedirs(IMAGES_DIR, exist_ok=True)
    os.makedirs(THUMBNAILS_DIR, exist_ok=True)
    # Bind first so a port conflict cannot open a tab for a different service.
    with ThreadingHTTPServer(("localhost", port), APIHandler) as httpd:
        url = f"http://localhost:{httpd.server_port}/react.html"
        threading.Thread(target=rebuild_missing_thumbnails, daemon=True, name="thumbnail-builder").start()
        print(f"AI Artist Tool server: {url}")
        print(f"Local archive directory: {DATA_DIR}")
        browser_timer = None
        if open_browser:
            browser_timer = threading.Timer(0.3, webbrowser.open_new_tab, args=(url,))
            browser_timer.daemon = True
            browser_timer.start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            if browser_timer:
                browser_timer.cancel()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Start the AI Artist Tool local service")
    parser.add_argument("--no-browser", action="store_true", help="Do not open a browser tab on startup")
    args = parser.parse_args()
    main(open_browser=not args.no_browser)
