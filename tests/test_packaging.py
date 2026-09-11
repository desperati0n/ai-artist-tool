import os
from pathlib import Path
import tempfile
import unittest
import zipfile

import build_exe
from server.config import configured_data_dir, resource_dir


class RuntimePathTests(unittest.TestCase):
    def test_source_resources_and_data_stay_in_project(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            project_root = Path(temporary_directory)
            module_file = project_root / "server" / "config.py"
            resources = resource_dir(str(module_file), frozen=False)
            data = configured_data_dir({}, base_dir=resources, frozen=False)
            self.assertEqual(resources, str(project_root.resolve()))
            self.assertEqual(data, str((project_root / "data").resolve()))

    def test_frozen_resources_use_bundle_and_data_stays_beside_exe(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            resources = resource_dir(frozen=True, bundle_dir=str(root / "bundle"))
            data = configured_data_dir(
                {"LOCALAPPDATA": str(root / "ignored-profile")},
                base_dir=resources,
                frozen=True,
                executable=str(root / "portable" / "AIArtistTool.exe"),
            )
            self.assertEqual(resources, str((root / "bundle").resolve()))
            self.assertEqual(data, str((root / "portable" / "data").resolve()))

    def test_data_directory_override_wins_for_every_runtime(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            expected = Path(temporary_directory) / "custom-data"
            data = configured_data_dir(
                {"AI_ARTIST_DATA_DIR": str(expected)},
                frozen=True,
                executable="ignored.exe",
            )
            self.assertEqual(data, str(expected.resolve()))


class BuildCommandTests(unittest.TestCase):
    def test_one_file_build_embeds_frontend_without_user_data(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            command = build_exe.pyinstaller_command(root, "python-test")
            self.assertEqual(command[:3], ["python-test", "-m", "PyInstaller"])
            self.assertIn("--onefile", command)
            self.assertIn("--console", command)
            add_data = command[command.index("--add-data") + 1]
            self.assertEqual(add_data, f"{root.resolve() / 'dist'}{os.pathsep}dist")
            self.assertNotIn(f"{root.resolve() / 'data'}{os.pathsep}data", command)
            self.assertEqual(command[-1], str(root.resolve() / "run_server.py"))

    def test_source_archive_contains_code_but_not_private_or_generated_data(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            (root / "package.json").write_text('{"version":"1.2.3"}', encoding="utf-8")
            (root / "run_server.py").write_text("print('ok')", encoding="utf-8")
            (root / "server").mkdir()
            (root / "server" / "config.py").write_text("PORT = 1", encoding="utf-8")
            (root / "design").mkdir()
            (root / "design" / "unused.png").write_bytes(b"unused")
            (root / "data").mkdir()
            (root / "data" / "private.json").write_text("private", encoding="utf-8")

            archive_path = build_exe.create_source_archive(root)

            with zipfile.ZipFile(archive_path) as archive:
                names = set(archive.namelist())
            prefix = "AIArtistTool-v1.2.3-source/"
            self.assertIn(prefix + "run_server.py", names)
            self.assertIn(prefix + "server/config.py", names)
            self.assertNotIn(prefix + "data/private.json", names)
            self.assertNotIn(prefix + "design/unused.png", names)


if __name__ == "__main__":
    unittest.main()
