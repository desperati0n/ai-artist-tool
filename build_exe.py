"""Build the frontend, one-file Windows executable, and source archive."""
from __future__ import annotations

import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import zipfile


PROJECT_ROOT = Path(__file__).resolve().parent
APP_NAME = "AIArtistTool"
SOURCE_DIRECTORIES = ("server", "src", "plugins", "tests")
EXCLUDED_SOURCE_NAMES = {
    "__pycache__",
    ".agents",
    ".git",
    ".refactor-tmp",
    "backups",
    "build",
    "data",
    "dist",
    "node_modules",
    "playwright-report",
    "release",
    "test-results",
}
EXCLUDED_ROOT_FILES = {"skills-lock.json"}


def project_version(project_root=PROJECT_ROOT):
    package = json.loads((Path(project_root) / "package.json").read_text(encoding="utf-8"))
    return str(package["version"])


def pyinstaller_command(project_root=PROJECT_ROOT, python_executable=sys.executable):
    project_root = Path(project_root).resolve()
    add_data = f"{project_root / 'dist'}{os.pathsep}dist"
    return [
        python_executable,
        "-m",
        "PyInstaller",
        "--noconfirm",
        "--clean",
        "--onefile",
        "--console",
        "--noupx",
        "--name",
        APP_NAME,
        "--distpath",
        str(project_root / "release"),
        "--workpath",
        str(project_root / "build" / "pyinstaller"),
        "--specpath",
        str(project_root / "build"),
        "--version-file",
        str(project_root / "windows_version_info.txt"),
        "--add-data",
        add_data,
        str(project_root / "run_server.py"),
    ]


def source_files(project_root=PROJECT_ROOT):
    project_root = Path(project_root).resolve()
    files = [
        path
        for path in project_root.iterdir()
        if path.is_file() and path.name not in EXCLUDED_ROOT_FILES
    ]
    for directory_name in SOURCE_DIRECTORIES:
        directory = project_root / directory_name
        if not directory.is_dir():
            continue
        files.extend(
            path
            for path in directory.rglob("*")
            if path.is_file()
            and not any(part in EXCLUDED_SOURCE_NAMES for part in path.relative_to(project_root).parts)
            and path.suffix not in {".pyc", ".pyo"}
        )
    return sorted(set(files))


def create_source_archive(project_root=PROJECT_ROOT):
    project_root = Path(project_root).resolve()
    release_dir = project_root / "release"
    release_dir.mkdir(exist_ok=True)
    version = project_version(project_root)
    archive_path = release_dir / f"{APP_NAME}-v{version}-source.zip"
    archive_root = f"{APP_NAME}-v{version}-source"
    with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in source_files(project_root):
            relative_path = path.relative_to(project_root)
            archive.write(path, Path(archive_root) / relative_path)
    return archive_path


def main():
    if importlib.util.find_spec("PyInstaller") is None:
        raise SystemExit(
            "PyInstaller is not installed. Run: python -m pip install -r requirements-build.txt"
        )

    npm = shutil.which("npm.cmd" if os.name == "nt" else "npm")
    if not npm:
        raise SystemExit("npm is not installed or is not available on PATH")

    (PROJECT_ROOT / "build").mkdir(exist_ok=True)
    (PROJECT_ROOT / "release").mkdir(exist_ok=True)
    subprocess.run([npm, "run", "build"], cwd=PROJECT_ROOT, check=True)

    frontend_entry = PROJECT_ROOT / "dist" / "react.html"
    if not frontend_entry.is_file():
        raise SystemExit(f"Frontend build did not create {frontend_entry}")

    subprocess.run(pyinstaller_command(), cwd=PROJECT_ROOT, check=True)
    executable = PROJECT_ROOT / "release" / f"{APP_NAME}.exe"
    if not executable.is_file():
        raise SystemExit(f"PyInstaller did not create {executable}")

    source_archive = create_source_archive()
    print(f"Created {executable}")
    print(f"Created {source_archive}")


if __name__ == "__main__":
    main()
