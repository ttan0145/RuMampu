"""Transient iPhone audio transcription. No audio or transcript is saved here."""
from __future__ import annotations

import os

MAX_AUDIO_BYTES = 2 * 1024 * 1024
DEFAULT_MODEL = "whisper-large-v3-turbo"


class SpeechError(Exception):
    def __init__(self, code: str, message: str, status: int):
        super().__init__(message)
        self.code, self.message, self.status = code, message, status


def transcribe_audio(audio: bytes, media_type: str, language: str) -> str:
    if not audio or len(audio) > MAX_AUDIO_BYTES:
        raise SpeechError("speech_invalid_audio", "Record a short clip, up to 30 seconds.", 400)
    media_type = media_type.split(";", 1)[0].lower()
    if media_type in ("audio/mp4", "video/mp4", "audio/x-m4a") and audio[4:8] == b"ftyp":
        filename = "recording.m4a"
    elif media_type in ("audio/webm", "video/webm") and audio[:4] == b"\x1a\x45\xdf\xa3":
        filename = "recording.webm"
    else:
        raise SpeechError("speech_invalid_audio", "The recording format is not supported.", 400)
    if language not in ("en", "ms", "zh"):
        raise SpeechError("speech_invalid_language", "Choose English, Malay or Chinese.", 400)
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        raise SpeechError("speech_unconfigured", "Voice transcription is not configured on this server.", 503)
    from groq import Groq
    try:
        # No automatic retries: a cancelled request must not consume extra quota.
        with Groq(api_key=api_key, timeout=35.0, max_retries=0) as client:
            result = client.audio.transcriptions.create(
                file=(filename, audio, media_type),
                model=os.getenv("GROQ_TRANSCRIPTION_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL,
                language=language, response_format="verbose_json", temperature=0,
            )
    except Exception as exc:
        status_code = getattr(exc, "status_code", None)
        if status_code == 429:
            raise SpeechError("speech_rate_limited", "Voice transcription is busy. Please wait and try again.", 429) from exc
        raise SpeechError("speech_failed", "Could not transcribe the recording. Please try again.", 502) from exc
    text = str(getattr(result, "text", "") or "").strip()
    segments = getattr(result, "segments", None) or []
    # Whisper may hallucinate phrases on silence. Suppress low-confidence segments
    # when every segment also reports a high probability of no speech.
    segments = [segment for segment in segments if isinstance(segment, dict)]
    silent = bool(segments) and all(
        segment.get("no_speech_prob", 0) >= 0.6 and segment.get("avg_logprob", 0) <= -1
        for segment in segments
    )
    if not text or silent:
        raise SpeechError("speech_no_speech", "No speech was recognised. Please record again.", 400)
    if len(text) > 12000:
        raise SpeechError("speech_invalid_audio", "Please record a shorter clip.", 400)
    return text
