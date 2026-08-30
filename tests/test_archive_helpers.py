import json
import tempfile
import unittest
from pathlib import Path

import migrate_legacy_archive
import run_server


PROJECT_ROOT = Path(__file__).resolve().parents[1]


class EntrypointTests(unittest.TestCase):
    def test_index_html_is_the_only_application_entrypoint(self):
        self.assertTrue((PROJECT_ROOT / "index.html").is_file())
        self.assertFalse((PROJECT_ROOT / "index-spotlight.html").exists())

    def test_index_loads_the_nai_plugin(self):
        index_html = (PROJECT_ROOT / "index.html").read_text(encoding="utf-8")
        self.assertIn('src="plugins/nai-batch-updater.js"', index_html)


class ArchiveServerHelperTests(unittest.TestCase):
    def test_image_proxy_url_allowlist(self):
        self.assertTrue(run_server.is_allowed_image_url("https://danbooru.donmai.us/data/image.png"))
        self.assertTrue(run_server.is_allowed_image_url("https://cdn.donmai.us/original/image.jpg"))
        self.assertFalse(run_server.is_allowed_image_url("http://cdn.donmai.us/image.jpg"))
        self.assertFalse(run_server.is_allowed_image_url("https://cdn.donmai.us.evil.example/image.jpg"))
        self.assertFalse(run_server.is_allowed_image_url("https://cdn.donmai.us@evil.example/image.jpg"))

    def test_safe_image_id_rejects_paths_and_invalid_characters(self):
        self.assertEqual(run_server.safe_image_id("artist_01-cover.jpg"), "artist_01-cover.jpg")
        self.assertIsNone(run_server.safe_image_id("../artist"))
        self.assertIsNone(run_server.safe_image_id("folder%2Fartist"))
        self.assertIsNone(run_server.safe_image_id("artist name"))
        self.assertIsNone(run_server.safe_image_id("x" * 161))

    def test_detect_image_extension(self):
        cases = {
            b"\x89PNG\r\n\x1a\nrest": ".png",
            b"\xff\xd8\xffrest": ".jpg",
            b"GIF89arest": ".gif",
            b"RIFF\x00\x00\x00\x00WEBPrest": ".webp",
            b"\x00\x00\x00\x18ftypavifrest": ".avif",
            b"not-an-image": None,
        }
        for header, expected in cases.items():
            with self.subTest(expected=expected):
                self.assertEqual(run_server.detect_image_extension(header), expected)

    def test_atomic_write_json_round_trip(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "nested" / "data.json"
            payload = {"artists": [{"id": "artist-1", "name": "测试"}]}
            run_server.atomic_write_json(str(target), payload)
            self.assertEqual(json.loads(target.read_text(encoding="utf-8")), payload)


class LegacyMigrationHelperTests(unittest.TestCase):
    def test_parse_header_filters_invalid_categories(self):
        header = (
            '{"version":15,"exportedAt":"2026-08-30T10:00:00Z",'
            '"imageCount":2,"theme":"dark","categories":["收藏",42,"草稿"],'
        )
        parsed = migrate_legacy_archive.parse_header(header)
        self.assertEqual(parsed["sourceVersion"], 15)
        self.assertEqual(parsed["expectedImageCount"], 2)
        self.assertEqual(parsed["theme"], "dark")
        self.assertEqual(parsed["categories"], ["收藏", "草稿"])

    def test_clean_artist_normalizes_missing_fields(self):
        cleaned, image = migrate_legacy_archive.clean_artist(
            {"id": "artist-1", "tag": "sample_tag", "imageUrl": "data:image/png;base64,AA=="}
        )
        self.assertEqual(cleaned["name"], "sample_tag")
        self.assertEqual(cleaned["categories"], ["未分类"])
        self.assertEqual(cleaned["socialLinks"], [])
        self.assertNotIn("imageUrl", cleaned)
        self.assertTrue(image.startswith("data:image/png"))

    def test_clean_preset_discards_invalid_items(self):
        cleaned, _ = migrate_legacy_archive.clean_preset(
            {
                "id": "preset-1",
                "items": [None, {}, {"id": "artist-1", "weight": 1.2}],
            }
        )
        self.assertEqual(cleaned["name"], "未命名预设")
        self.assertEqual(cleaned["items"], [{"id": "artist-1", "weight": 1.2}])


if __name__ == "__main__":
    unittest.main()
