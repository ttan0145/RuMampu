import json
from unittest.mock import patch

from django.core.cache import cache
from django.test import Client, TestCase

from .assistant_service import DAILY_MESSAGE_LIMIT, AssistantError, build_financial_snapshot
from .models import GuestProfile
from .services import profile_for_request


class _FakeRequest:
    def __init__(self, client_id: str):
        self.headers = {"X-RuMampu-Client-ID": client_id}
        self.session = {}


def _make_profile(client_id: str = "assistant-tests") -> GuestProfile:
    return profile_for_request(_FakeRequest(client_id))


class AssistantChatApiTests(TestCase):
    url = "/api/v1/assistant/chat/"

    def setUp(self):
        self.client = Client()
        cache.clear()

    def chat(self, messages=None, language="en"):
        payload = {
            "messages": messages if messages is not None
            else [{"role": "user", "content": "How is my income?"}],
            "language": language,
        }
        return self.client.post(self.url, data=json.dumps(payload), content_type="application/json")

    def test_successful_chat_returns_reply(self):
        with patch(
            "finance.views.assistant_service.answer_chat",
            return_value="Your record covers 2 months.",
        ) as mock_chat:
            response = self.chat()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["reply"], "Your record covers 2 months.")
        args, kwargs = mock_chat.call_args
        self.assertEqual(kwargs["ui_language"], "en")

    def test_last_message_must_be_from_user(self):
        response = self.chat(messages=[
            {"role": "user", "content": "Hi"},
            {"role": "assistant", "content": "Hello"},
        ])
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["code"], "validation_error")

    def test_empty_messages_rejected(self):
        response = self.chat(messages=[])
        self.assertEqual(response.status_code, 400)

    def test_unconfigured_maps_to_503(self):
        error = AssistantError("assistant_unconfigured", "Not configured.", 503)
        with patch("finance.views.assistant_service.answer_chat", side_effect=error):
            response = self.chat()
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["error"]["code"], "assistant_unconfigured")

    def test_rate_limit_maps_to_429(self):
        error = AssistantError("assistant_rate_limited", "Limit reached.", 429)
        with patch("finance.views.assistant_service.answer_chat", side_effect=error):
            response = self.chat()
        self.assertEqual(response.status_code, 429)


class AssistantServiceTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_daily_limit_enforced(self):
        profile = _make_profile("limit-tests")
        from . import assistant_service

        with patch.object(assistant_service, "_completion", return_value="ok"):
            for _ in range(DAILY_MESSAGE_LIMIT):
                assistant_service.answer_chat(profile, [{"role": "user", "content": "hi"}])
            with self.assertRaises(AssistantError) as ctx:
                assistant_service.answer_chat(profile, [{"role": "user", "content": "hi"}])
        self.assertEqual(ctx.exception.code, "assistant_rate_limited")

    def test_completion_failure_maps_to_assistant_failed(self):
        profile = _make_profile("failure-tests")
        from . import assistant_service

        with patch.object(assistant_service, "_completion", side_effect=RuntimeError("boom")):
            with self.assertRaises(AssistantError) as ctx:
                assistant_service.answer_chat(profile, [{"role": "user", "content": "hi"}])
        self.assertEqual(ctx.exception.code, "assistant_failed")

    def test_system_prompt_contains_snapshot_and_rules(self):
        profile = _make_profile("prompt-tests")
        from . import assistant_service

        captured: dict = {}

        def fake_completion(model, messages):
            captured["model"] = model
            captured["messages"] = messages
            return "answer"

        with patch.object(assistant_service, "_completion", side_effect=fake_completion):
            assistant_service.answer_chat(
                profile,
                [{"role": "user", "content": "berapa gaji saya bulan lepas?"}],
                ui_language="ms",
            )
        system = captured["messages"][0]
        self.assertEqual(system["role"], "system")
        self.assertIn("recorded_month_count", system["content"])
        self.assertIn("ONLY discuss", system["content"])
        self.assertIn("Bahasa Melayu", system["content"])
        self.assertEqual(captured["messages"][-1]["content"], "berapa gaji saya bulan lepas?")

    def test_prompt_names_controls_in_the_apps_language(self):
        """With the app in Chinese, the map must carry the Chinese labels the
        user actually sees, never the English ones (user report 15 Sep)."""
        profile = _make_profile("labels-tests")
        from . import assistant_service

        captured: dict = {}

        def fake_completion(model, messages):
            captured["messages"] = messages
            return "answer"

        labels = {"add_income": "添加收入", "tab_money": "钱", "income_page": "收入", "bogus": "ignored"}
        with patch.object(assistant_service, "_completion", side_effect=fake_completion):
            assistant_service.answer_chat(
                profile,
                [{"role": "user", "content": "我要怎么添加收入？"}],
                ui_language="zh",
                ui_labels=labels,
            )
        system = captured["messages"][0]["content"]
        self.assertIn("添加收入", system)
        self.assertNotIn("Add income", system)
        self.assertNotIn("ignored", system)
        self.assertIn("shown in Chinese", system)
        self.assertIn("EXACTLY as they appear", system)

    def test_record_terms_are_localized_in_the_prompt(self):
        from . import assistant_service

        snap = {"expenses_recent_months": [{"by_category": {"Family": 150.0, "Meals": 45.0}}],
                "sources": ["Grab", "Family"], "note": "Family"}
        out = assistant_service._localize_terms(snap, {"Family": "Keluarga", "Meals": "Makanan"})
        self.assertEqual(out["expenses_recent_months"][0]["by_category"], {"Keluarga": 150.0, "Makanan": 45.0})
        self.assertEqual(out["sources"], ["Grab", "Keluarga"])
        self.assertEqual(out["note"], "Keluarga")
        self.assertEqual(assistant_service._localize_terms(snap, None), snap)

    def test_prompt_falls_back_to_english_labels(self):
        profile = _make_profile("labels-default")
        from . import assistant_service

        captured: dict = {}
        with patch.object(assistant_service, "_completion", side_effect=lambda m, msgs: captured.update(messages=msgs) or "ok"):
            assistant_service.answer_chat(profile, [{"role": "user", "content": "hi"}])
        self.assertIn("Add income", captured["messages"][0]["content"])

    def test_reply_is_stripped_of_markdown(self):
        profile = _make_profile("markdown-tests")
        from . import assistant_service

        raw = "### Your income\n\n**RM 1,400** this month – so far.  \n* First `item`\n* Second item\n\n\n\nThat is *all*."
        with patch.object(assistant_service, "_completion", return_value=raw):
            reply = assistant_service.answer_chat(profile, [{"role": "user", "content": "hi"}])
        self.assertEqual(
            reply,
            "Your income\n\nRM 1,400 this month, so far.\n- First item\n- Second item\n\nThat is all.",
        )

    def test_view_passes_labels_through(self):
        with patch(
            "finance.views.assistant_service.answer_chat",
            return_value="ok",
        ) as mock_chat:
            payload = {
                "messages": [{"role": "user", "content": "hi"}],
                "language": "zh",
                "ui_labels": {"add_income": "添加收入"},
            }
            response = Client().post(
                "/api/v1/assistant/chat/", data=json.dumps(payload), content_type="application/json",
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(mock_chat.call_args.kwargs["ui_labels"], {"add_income": "添加收入"})


class SnapshotTests(TestCase):
    def test_empty_profile_snapshot_is_honest(self):
        profile = _make_profile("snapshot-empty")
        snapshot = build_financial_snapshot(profile)
        self.assertEqual(snapshot["recorded_month_count"], 0)
        self.assertIsNone(snapshot["income_statistics"])
        self.assertIsNone(snapshot["housing_test"])
        self.assertEqual(snapshot["expenses_recent_months"], [])

    def test_snapshot_reflects_recorded_data(self):
        profile = _make_profile("snapshot-data")
        client = Client()
        headers = {
            "content_type": "application/json",
            "headers": {"X-RuMampu-Client-ID": "snapshot-data"},
        }
        for amount, date in (("900.00", "2026-06-05"), ("1100.00", "2026-07-05")):
            response = client.post(
                "/api/v1/income/entries/",
                data=json.dumps({
                    "amount": amount,
                    "date": date,
                    "entry_method": "historical_total",
                    "confirm_outlier": True,
                }),
                **headers,
            )
            self.assertEqual(response.status_code, 201, response.content)
        snapshot = build_financial_snapshot(profile)
        self.assertEqual(snapshot["recorded_month_count"], 2)
        months = [row["month"] for row in snapshot["income_months"]]
        self.assertEqual(months, ["2026-06", "2026-07"])
        self.assertIsNotNone(snapshot["income_statistics"])
        self.assertTrue(json.dumps(snapshot, default=str))
