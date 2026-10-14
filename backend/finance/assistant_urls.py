from django.urls import path

from .views import AssistantActionPreviewView, AssistantChatView, SpeechTranscriptionView


urlpatterns = [
    path("transcribe/", SpeechTranscriptionView.as_view(), name="speech-transcribe"),
    path("chat/", AssistantChatView.as_view(), name="assistant-chat"),
    path("action-preview/", AssistantActionPreviewView.as_view(), name="assistant-action-preview"),
]
