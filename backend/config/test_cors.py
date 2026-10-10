from django.test import SimpleTestCase


class CreateRequestCorsTests(SimpleTestCase):
    def test_web_origin_can_send_idempotency_header(self):
        response = self.client.options(
            "/api/v1/auth/login/",
            HTTP_ORIGIN="https://rumampu-frontend.vercel.app",
            HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
            HTTP_ACCESS_CONTROL_REQUEST_HEADERS="content-type,idempotency-key",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Access-Control-Allow-Origin"], "https://rumampu-frontend.vercel.app")
        allowed = {name.strip().lower() for name in response["Access-Control-Allow-Headers"].split(",")}
        self.assertIn("idempotency-key", allowed)
