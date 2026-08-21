"""Atomically convert the local image archive to full-resolution JPEG files."""

import argparse
import json
import os
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageOps


def convert_archive(project_root, quality=94):
    project_root = project_root.resolve()
    data_dir = project_root / "data"
    images_dir = data_dir / "images"
    if not images_dir.is_dir():
        raise FileNotFoundError(f"Image directory does not exist: {images_dir}")

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    stage_dir = data_dir / f"images.jpeg-stage-{timestamp}"
    backup_dir = data_dir / f"images.before-jpeg-{timestamp}"
    if stage_dir.exists() or backup_dir.exists():
        raise FileExistsError("A JPEG conversion directory with the same timestamp already exists")
    stage_dir.mkdir()

    source_files = sorted(path for path in images_dir.iterdir() if path.is_file())
    source_stems = [path.stem for path in source_files]
    if len(source_stems) != len(set(source_stems)):
        shutil.rmtree(stage_dir, ignore_errors=True)
        raise ValueError("Two source images share the same stem and would overwrite one JPEG")

    source_bytes = sum(path.stat().st_size for path in source_files)
    transparent_images = 0
    icc_profiles_preserved = 0
    converted = 0
    dimensions = {}

    try:
        for index, source in enumerate(source_files, 1):
            target = stage_dir / f"{source.stem}.jpg"
            with Image.open(source) as opened:
                opened.load()
                image = ImageOps.exif_transpose(opened)
                dimensions[source.stem] = image.size
                icc_profile = opened.info.get("icc_profile")
                if icc_profile:
                    icc_profiles_preserved += 1

                has_alpha = "A" in image.getbands() or (image.mode == "P" and "transparency" in opened.info)
                if has_alpha:
                    rgba = image.convert("RGBA")
                    alpha = rgba.getchannel("A")
                    if alpha.getextrema()[0] < 255:
                        transparent_images += 1
                    rgb = Image.new("RGB", rgba.size, "white")
                    rgb.paste(rgba, mask=alpha)
                else:
                    rgb = image.convert("RGB")

                save_options = {
                    "format": "JPEG",
                    "quality": quality,
                    "subsampling": 0,
                    "optimize": True,
                    "progressive": True,
                }
                if icc_profile:
                    save_options["icc_profile"] = icc_profile
                rgb.save(target, **save_options)

            with Image.open(target) as verified:
                verified.load()
                if verified.format != "JPEG":
                    raise ValueError(f"Converted file is not JPEG: {target.name}")
                if verified.size != dimensions[source.stem]:
                    raise ValueError(
                        f"Dimension mismatch for {source.name}: {dimensions[source.stem]} -> {verified.size}"
                    )
            converted += 1
            if index % 20 == 0 or index == len(source_files):
                print(f"Converted {index}/{len(source_files)}", flush=True)
    except Exception:
        shutil.rmtree(stage_dir, ignore_errors=True)
        raise

    target_files = sorted(path for path in stage_dir.iterdir() if path.is_file())
    if len(target_files) != len(source_files):
        shutil.rmtree(stage_dir, ignore_errors=True)
        raise ValueError("Converted image count does not match the source")
    if {path.stem for path in target_files} != set(source_stems):
        shutil.rmtree(stage_dir, ignore_errors=True)
        raise ValueError("Converted image IDs do not match the source IDs")

    output_bytes = sum(path.stat().st_size for path in target_files)
    moved_source = False
    try:
        os.replace(images_dir, backup_dir)
        moved_source = True
        os.replace(stage_dir, images_dir)
    except Exception:
        if moved_source and backup_dir.exists() and not images_dir.exists():
            os.replace(backup_dir, images_dir)
        raise

    report = {
        "convertedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "quality": quality,
        "subsampling": "4:4:4",
        "resize": False,
        "backgroundForTransparency": "white",
        "images": converted,
        "transparentImages": transparent_images,
        "iccProfilesPreserved": icc_profiles_preserved,
        "sourceBytes": source_bytes,
        "jpegBytes": output_bytes,
        "bytesSaved": source_bytes - output_bytes,
        "reductionPercent": round((1 - output_bytes / source_bytes) * 100, 2) if source_bytes else 0,
        "originalImagesBackup": str(backup_dir),
    }
    report_path = data_dir / "jpeg-conversion-report.json"
    temporary_report = data_dir / ".jpeg-conversion-report.tmp"
    temporary_report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(temporary_report, report_path)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-root", type=Path, default=Path(__file__).resolve().parent)
    parser.add_argument("--quality", type=int, default=94)
    args = parser.parse_args()
    if not 1 <= args.quality <= 95:
        parser.error("Quality must be between 1 and 95")
    try:
        convert_archive(args.project_root, args.quality)
    except Exception as error:
        print(f"JPEG conversion failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
