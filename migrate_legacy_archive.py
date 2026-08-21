"""Stream a legacy Base64 JSON backup into the local filesystem archive."""

import argparse
import base64
import json
import os
import re
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

from run_server import IMAGE_EXTENSIONS, SAFE_ID, detect_image_extension, strip_png_metadata


CHUNK_SIZE = 4 * 1024 * 1024


class StreamingJsonArrays:
    def __init__(self, path):
        self.handle = open(path, "r", encoding="utf-8", buffering=CHUNK_SIZE)
        self.buffer = ""
        self.eof = False
        self.decoder = json.JSONDecoder()

    def close(self):
        self.handle.close()

    def _read_more(self):
        chunk = self.handle.read(CHUNK_SIZE)
        if chunk:
            self.buffer += chunk
            return True
        self.eof = True
        return False

    def seek_marker(self, marker, capture_prefix=False):
        captured = []
        keep = max(0, len(marker) - 1)
        while True:
            at = self.buffer.find(marker)
            if at >= 0:
                if capture_prefix:
                    captured.append(self.buffer[:at])
                self.buffer = self.buffer[at + len(marker):]
                return "".join(captured)
            if self.eof:
                raise ValueError(f"Backup is missing {marker}")
            if len(self.buffer) > keep:
                cut = len(self.buffer) - keep
                if capture_prefix:
                    captured.append(self.buffer[:cut])
                self.buffer = self.buffer[cut:]
            self._read_more()

    def iter_current_array(self):
        while True:
            self.buffer = self.buffer.lstrip(" \t\r\n,")
            if not self.buffer and not self._read_more():
                raise ValueError("Backup ended inside an array")
            if self.buffer.startswith("]"):
                self.buffer = self.buffer[1:]
                return
            try:
                value, end = self.decoder.raw_decode(self.buffer)
            except json.JSONDecodeError as error:
                if self._read_more():
                    continue
                raise ValueError(f"Invalid or truncated JSON object near character {error.pos}") from error
            self.buffer = self.buffer[end:]
            yield value


def parse_header(header):
    def scalar(pattern, fallback=None):
        match = re.search(pattern, header)
        return match.group(1) if match else fallback

    category_match = re.search(r'"categories":(\[[\s\S]*?\])\s*,?\s*$', header)
    categories = json.loads(category_match.group(1)) if category_match else []
    return {
        "sourceVersion": int(scalar(r'"version"\s*:\s*(\d+)', "0")),
        "sourceExportedAt": scalar(r'"exportedAt"\s*:\s*"([^"]*)"', ""),
        "expectedImageCount": int(scalar(r'"imageCount"\s*:\s*(\d+)', "0")),
        "theme": scalar(r'"theme"\s*:\s*"(light|dark)"', "light"),
        "categories": [item for item in categories if isinstance(item, str)],
    }


def safe_record_id(value, record_type):
    record_id = str(value or "")
    if not SAFE_ID.fullmatch(record_id):
        raise ValueError(f"Unsafe {record_type} id: {record_id!r}")
    return record_id


def decode_data_url(value):
    if not isinstance(value, str) or not value.startswith("data:"):
        return None
    header, separator, encoded = value.partition(",")
    if not separator or ";base64" not in header.lower():
        raise ValueError("Only Base64 data URLs are supported")
    return base64.b64decode(encoded, validate=False)


def write_image(images_dir, record_id, image_value):
    raw = decode_data_url(image_value)
    if raw is None:
        return None, 0
    extension = detect_image_extension(raw[:32])
    if not extension:
        raise ValueError("Unsupported image signature")
    destination = images_dir / f"{record_id}{extension}"
    temporary = images_dir / f".{record_id}.importing"
    temporary.write_bytes(raw)
    removed_metadata = 0
    try:
        if extension == ".png":
            removed_metadata = strip_png_metadata(str(temporary))
        os.replace(temporary, destination)
    finally:
        if temporary.exists():
            temporary.unlink()
    return destination.name, removed_metadata


def clean_artist(item):
    cleaned = dict(item)
    image_value = cleaned.pop("imageUrl", cleaned.pop("image", ""))
    cleaned["id"] = safe_record_id(cleaned.get("id"), "artist")
    cleaned["name"] = str(cleaned.get("name") or cleaned.get("tag") or "Unknown")
    cleaned["tag"] = str(cleaned.get("tag") or cleaned.get("name") or "")
    categories = cleaned.get("categories")
    cleaned["categories"] = categories if isinstance(categories, list) and categories else ["未分类"]
    cleaned["socialLinks"] = cleaned.get("socialLinks") if isinstance(cleaned.get("socialLinks"), list) else []
    return cleaned, image_value


def clean_preset(item, valid_artist_ids=None):
    cleaned = dict(item)
    image_value = cleaned.pop("imageUrl", cleaned.pop("image", ""))
    cleaned["id"] = safe_record_id(cleaned.get("id"), "preset")
    cleaned["name"] = str(cleaned.get("name") or "未命名预设")
    items = []
    for preset_item in cleaned.get("items", []):
        if not isinstance(preset_item, dict):
            continue
        artist_id = str(preset_item.get("id") or "")
        if not artist_id:
            continue
        items.append({**preset_item, "id": artist_id})
    cleaned["items"] = items
    return cleaned, image_value


def restore_presets_only(source, data_path):
    reader = StreamingJsonArrays(source)
    try:
        reader.seek_marker('"artists":[')
        for _ in reader.iter_current_array():
            pass
        reader.seek_marker('"presets":[')
        presets = []
        for item in reader.iter_current_array():
            if isinstance(item, dict):
                cleaned, _ = clean_preset(item)
                presets.append(cleaned)
    finally:
        reader.close()

    data = json.loads(data_path.read_text(encoding="utf-8"))
    data["presets"] = presets
    temporary = data_path.with_name(".data.presets-repair.tmp")
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(temporary, data_path)
    return presets


def migrate(source, project_root):
    source = source.resolve()
    project_root = project_root.resolve()
    data_dir = project_root / "data"
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    stage_dir = project_root / f"data.import-stage-{timestamp}"
    backup_dir = project_root / f"data.before-legacy-import-{timestamp}"
    if stage_dir.exists() or backup_dir.exists():
        raise FileExistsError("A migration directory with the same timestamp already exists")
    images_dir = stage_dir / "images"
    images_dir.mkdir(parents=True)

    reader = StreamingJsonArrays(source)
    artists = []
    presets = []
    image_files = 0
    image_bytes = 0
    metadata_bytes_removed = 0
    image_errors = []
    try:
        header_text = reader.seek_marker('"artists":[', capture_prefix=True)
        header = parse_header(header_text)
        print(
            f"Source v{header['sourceVersion']}: expected {header['expectedImageCount']} images; "
            f"streaming from {source}",
            flush=True,
        )

        for index, item in enumerate(reader.iter_current_array(), 1):
            if not isinstance(item, dict):
                continue
            cleaned, image_value = clean_artist(item)
            artists.append(cleaned)
            if image_value:
                try:
                    filename, removed = write_image(images_dir, cleaned["id"], image_value)
                    if filename:
                        image_files += 1
                        image_bytes += (images_dir / filename).stat().st_size
                        metadata_bytes_removed += removed
                except Exception as error:
                    image_errors.append({"type": "artist", "id": cleaned["id"], "error": str(error)})
            if index % 20 == 0:
                print(f"Artists: {index}; images: {image_files}; errors: {len(image_errors)}", flush=True)

        reader.seek_marker('"presets":[')
        valid_artist_ids = {artist["id"] for artist in artists}
        for index, item in enumerate(reader.iter_current_array(), 1):
            if not isinstance(item, dict):
                continue
            cleaned, image_value = clean_preset(item, valid_artist_ids)
            presets.append(cleaned)
            if image_value:
                try:
                    filename, removed = write_image(images_dir, cleaned["id"], image_value)
                    if filename:
                        image_files += 1
                        image_bytes += (images_dir / filename).stat().st_size
                        metadata_bytes_removed += removed
                except Exception as error:
                    image_errors.append({"type": "preset", "id": cleaned["id"], "error": str(error)})
    except Exception:
        shutil.rmtree(stage_dir, ignore_errors=True)
        raise
    finally:
        reader.close()

    manifest = {
        "version": 14,
        "updatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "theme": header["theme"],
        "categories": header["categories"],
        "artists": artists,
        "presets": presets,
    }
    manifest_path = stage_dir / "data.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    report = {
        "source": str(source),
        "sourceBytes": source.stat().st_size,
        "sourceVersion": header["sourceVersion"],
        "sourceExportedAt": header["sourceExportedAt"],
        "expectedImageCount": header["expectedImageCount"],
        "artists": len(artists),
        "presets": len(presets),
        "imagesExtracted": image_files,
        "imageBytes": image_bytes,
        "pngMetadataBytesRemoved": metadata_bytes_removed,
        "imageErrors": image_errors,
    }
    (stage_dir / "migration-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    serialized = manifest_path.read_text(encoding="utf-8")
    if '"imageUrl"' in serialized or '"image"' in serialized or "data:" in serialized:
        shutil.rmtree(stage_dir, ignore_errors=True)
        raise ValueError("Verification failed: image data remains in the new manifest")
    if len(list(images_dir.iterdir())) != image_files:
        shutil.rmtree(stage_dir, ignore_errors=True)
        raise ValueError("Verification failed: extracted image count does not match files")
    if image_errors:
        shutil.rmtree(stage_dir, ignore_errors=True)
        raise ValueError(f"Migration stopped because {len(image_errors)} images could not be extracted")
    if header["expectedImageCount"] and image_files != header["expectedImageCount"]:
        shutil.rmtree(stage_dir, ignore_errors=True)
        raise ValueError(
            f"Migration stopped: backup declares {header['expectedImageCount']} images, extracted {image_files}"
        )

    moved_old_data = False
    try:
        if data_dir.exists():
            os.replace(data_dir, backup_dir)
            moved_old_data = True
        os.replace(stage_dir, data_dir)
    except Exception:
        if moved_old_data and backup_dir.exists() and not data_dir.exists():
            os.replace(backup_dir, data_dir)
        raise

    print(json.dumps({**report, "backupDirectory": str(backup_dir) if moved_old_data else None}, ensure_ascii=False, indent=2))
    return report, backup_dir if moved_old_data else None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path, help="Legacy artist_manager_backup JSON file")
    parser.add_argument("--project-root", type=Path, default=Path(__file__).resolve().parent)
    parser.add_argument("--presets-only", action="store_true", help="Restore source preset records without re-extracting images")
    args = parser.parse_args()
    if not args.archive.is_file():
        parser.error(f"Archive does not exist: {args.archive}")
    try:
        if args.presets_only:
            presets = restore_presets_only(args.archive.resolve(), args.project_root.resolve() / "data" / "data.json")
            print(json.dumps({"presetsRestored": len(presets)}, ensure_ascii=False))
        else:
            migrate(args.archive, args.project_root)
    except Exception as error:
        print(f"Migration failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
