import http.client
import threading
import unittest
from http.server import ThreadingHTTPServer
from unittest.mock import patch

import run_server


class FrontendRoutingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), run_server.APIHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def request(self, method, path):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=5)
        try:
            connection.request(method, path)
            response = connection.getresponse()
            return response.status, dict(response.getheaders()), response.read()
        finally:
            connection.close()

    def test_root_opens_react_for_get_and_head(self):
        for method in ("GET", "HEAD"):
            with self.subTest(method=method):
                status, headers, body = self.request(method, "/")
                self.assertEqual(status, 302)
                self.assertEqual(headers["Location"], "/react.html")
                self.assertEqual(headers["Cache-Control"], "no-store")
                self.assertEqual(body, b"")

    def test_explicit_legacy_entry_is_still_available(self):
        status, headers, body = self.request("GET", "/index.html")
        self.assertEqual(status, 200)
        self.assertNotIn("Location", headers)
        self.assertIn(b'plugins/nai-batch-updater.js', body)


class StartupTests(unittest.TestCase):
    def test_opens_react_using_actual_bound_port(self):
        with patch.object(run_server, "ThreadingHTTPServer") as server_factory, \
             patch.object(run_server.os, "makedirs"), \
             patch.object(run_server.threading, "Thread"), \
             patch.object(run_server.threading, "Timer") as timer_factory, \
             patch.object(run_server.webbrowser, "open_new_tab") as open_tab:
            server = server_factory.return_value.__enter__.return_value
            server.server_port = 9123
            run_server.main(port=9123)
            server_factory.assert_called_once_with(("localhost", 9123), run_server.APIHandler)
            timer_factory.assert_called_once_with(0.3, open_tab, args=("http://localhost:9123/react.html",))
            timer_factory.return_value.start.assert_called_once()
            timer_factory.return_value.cancel.assert_called_once()
            server.serve_forever.assert_called_once()

    def test_no_browser_option_runs_only_the_service(self):
        with patch.object(run_server, "ThreadingHTTPServer"), \
             patch.object(run_server.os, "makedirs"), \
             patch.object(run_server.threading, "Thread"), \
             patch.object(run_server.threading, "Timer") as timer_factory:
            run_server.main(open_browser=False)
            timer_factory.assert_not_called()

    def test_port_conflict_does_not_open_a_browser(self):
        with patch.object(run_server, "ThreadingHTTPServer", side_effect=OSError("Port in use")), \
             patch.object(run_server.os, "makedirs"), \
             patch.object(run_server.threading, "Timer") as timer_factory:
            with self.assertRaises(OSError):
                run_server.main()
            timer_factory.assert_not_called()


if __name__ == "__main__":
    unittest.main()
