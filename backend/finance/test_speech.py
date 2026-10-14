from types import SimpleNamespace
from unittest.mock import patch

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase

from .models import IncomeEntry, ExpenseEntry


class SpeechTranscriptionTests(TestCase):
    url = "/api/v1/assistant/transcribe/"
    audio = b"\x00\x00\x00\x18ftypM4A " + b"example encoded audio"

    def setUp(self):
        cache.clear()
        self.key = patch.dict("os.environ", {"GROQ_API_KEY": "test-key"})
        self.key.start()
        self.addCleanup(self.key.stop)
        self.groq = patch("groq.Groq")
        self.factory = self.groq.start()
        self.addCleanup(self.groq.stop)
        self.transcription = self.factory.return_value.__enter__.return_value.audio.transcriptions.create
        self.transcription.return_value = SimpleNamespace(text="Earned fifteen ringgit", segments=[])

    def post(self, **changes):
        data = {"audio": SimpleUploadedFile("clip.m4a", self.audio, content_type="audio/mp4"),
                "language": "en", "audio_consent": "true"}
        data.update(changes)
        return self.client.post(self.url, data, HTTP_X_RUMAMPU_CLIENT_ID="speech-tests")

    def test_transcription_uses_whisper_and_does_not_create_financial_entries(self):
        response = self.post()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"text": "Earned fifteen ringgit"})
        self.assertEqual(response.headers["Cache-Control"], "no-store")
        options = self.transcription.call_args.kwargs
        self.assertEqual(options["model"], "whisper-large-v3-turbo")
        self.assertEqual(options["file"], ("recording.m4a", self.audio, "audio/mp4"))
        self.assertEqual(options["language"], "en")
        self.assertEqual(IncomeEntry.objects.count(), 0)
        self.assertEqual(ExpenseEntry.objects.count(), 0)

    def test_consent_is_required_before_audio_is_forwarded(self):
        response = self.post(audio_consent="false")
        self.assertEqual(response.status_code, 400)
        self.factory.assert_not_called()

    def test_oversized_audio_is_rejected_without_provider_call(self):
        response = self.post(audio=SimpleUploadedFile("large.m4a", self.audio + b"x" * (2 * 1024 * 1024), content_type="audio/mp4"))
        self.assertEqual(response.status_code, 400)
        self.factory.assert_not_called()

    def test_bad_audio_format_is_rejected_without_provider_call(self):
        response = self.post(audio=SimpleUploadedFile("bad.m4a", b"not audio", content_type="audio/mp4"))
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["code"], "speech_invalid_audio")
        self.factory.assert_not_called()

    def test_audio_never_uses_a_temporary_file_upload_handler(self):
        with patch("django.core.files.uploadhandler.TemporaryFileUploadHandler.new_file", side_effect=AssertionError("audio must stay in memory")):
            self.assertEqual(self.post().status_code, 200)

    def test_provider_quota_error_is_a_retryable_429(self):
        error = RuntimeError("quota")
        error.status_code = 429
        self.transcription.side_effect = error
        response = self.post()
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.json()["error"]["code"], "speech_rate_limited")

    def test_silence_is_not_returned_as_a_hallucinated_entry(self):
        self.transcription.return_value = SimpleNamespace(text="Thank you for watching", segments=[{"no_speech_prob": 0.9, "avg_logprob": -2}])
        response = self.post()
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["code"], "speech_no_speech")

    def test_missing_provider_configuration_returns_503(self):
        with patch.dict("os.environ", {"GROQ_API_KEY": ""}):
            response = self.post()
        self.assertEqual(response.status_code, 503)
        self.factory.assert_not_called()
