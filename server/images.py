import os
import struct
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from PIL import Image, ImageOps
from .config import ALLOWED_PROXY_HOSTS, IMAGES_DIR, IMAGE_EXTENSIONS, PNG_STRIPPABLE_CHUNKS, SAFE_ID, THUMBNAILS_DIR, THUMBNAIL_QUALITY, THUMBNAIL_SIZE


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
