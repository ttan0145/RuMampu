import json
from unittest.mock import patch

from django.core.cache import cache
from django.test import Client, TestCase

from config.throttles import AssistantActionPreviewThrottle

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


class AssistantActionPreviewApiTests(TestCase):
    url = "/api/v1/assistant/action-preview/"

    def setUp(self):
        self.client = Client()
        cache.clear()

    def tearDown(self):
        cache.clear()

    def payload(self):
        return {
            "text": "add my income today two hundred ringgit",
            "language": "en",
            "income_sources": [{"id": "11", "label": "E-hailing"}],
            "expense_categories": [{"id": "21", "label": "Meals"}],
            "commitments": [{"id": "31", "label": "Rent"}],
            "limit_categories": [
                {"id": "total", "label": "Whole month"},
                {"id": "21", "label": "Meals"},
            ],
            "default_income_source_id": "11",
        }

    def test_returns_reviewable_action_without_writing(self):
        expected = {
            "status": "ready",
            "message": "",
            "actions": [{
                "kind": "income",
                "amount": "200.00",
                "date": "2026-10-01",
                "target_id": "11",
                "target_label": "E-hailing",
            }],
        }
        with patch(
            "finance.views.assistant_action_service.preview_action",
            return_value=expected,
        ) as preview:
            response = self.client.post(
                self.url, data=json.dumps(self.payload()), content_type="application/json",
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), expected)
        self.assertEqual(preview.call_args.kwargs["default_income_source_id"], "11")

    def test_rejects_unknown_language(self):
        payload = self.payload()
        payload["language"] = "fr"
        response = self.client.post(
            self.url, data=json.dumps(payload), content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    @patch.object(
        AssistantActionPreviewThrottle,
        "THROTTLE_RATES",
        {"assistant_action_preview": "1/hour"},
    )
    def test_repeated_action_previews_are_throttled_before_another_model_call(self):
        result = {"status": "clarify", "message": "Please add an amount.", "actions": []}
        with patch(
            "finance.views.assistant_action_service.preview_action",
            return_value=result,
        ) as preview:
            first = self.client.post(
                self.url, data=json.dumps(self.payload()), content_type="application/json",
            )
            blocked = self.client.post(
                self.url, data=json.dumps(self.payload()), content_type="application/json",
            )

        self.assertEqual(first.status_code, 200)
        self.assertEqual(blocked.status_code, 429)
        preview.assert_called_once()


class AssistantActionServiceTests(TestCase):
    def setUp(self):
        from . import assistant_action_service

        self.service = assistant_action_service
        self.options = {
            "income_sources": [{"id": "11", "label": "E-hailing"}],
            "expense_categories": [{"id": "21", "label": "Meals"}],
            "commitments": [{"id": "31", "label": "Rent"}],
            "limit_categories": [{"id": "total", "label": "Whole month"}],
        }

    def preview(self, model_result, **overrides):
        args = {
            "text": "spoken command",
            "language": "en",
            **self.options,
            "default_income_source_id": "11",
            **overrides,
        }
        with patch.object(self.service, "_completion", return_value=model_result):
            return self.service.preview_action(**args)

    def test_income_uses_default_source_and_normalises_amount(self):
        result = self.preview({
            "actions": [{
                "intent": "income", "amount": "200", "date": "2026-10-01", "target_id": None,
            }],
        })
        self.assertEqual(result["status"], "ready")
        self.assertEqual(result["actions"][0]["amount"], "200.00")
        self.assertEqual(result["actions"][0]["target_id"], "11")

    def test_numeric_model_target_id_is_normalised(self):
        result = self.preview({
            "actions": [{
                "intent": "expense", "amount": 12, "date": "2026-10-01", "target_id": 21,
            }],
        })
        self.assertEqual(result["status"], "ready")
        self.assertEqual(result["actions"][0]["target_id"], "21")

    def test_unknown_expense_category_is_left_blank_for_review(self):
        result = self.preview({
            "actions": [{
                "intent": "expense", "amount": 12, "date": "2026-10-01", "target_id": "invented",
            }],
        })
        self.assertEqual(result["status"], "ready")
        self.assertEqual(result["actions"][0]["target_id"], "")
        self.assertEqual(result["actions"][0]["target_label"], "")

    def test_missing_expense_category_is_left_blank_for_review(self):
        result = self.preview({
            "actions": [{
                "intent": "expense", "amount": 12, "date": "2026-10-01", "target_id": None,
            }],
        })
        self.assertEqual(result["status"], "ready")
        self.assertEqual(result["actions"][0]["target_id"], "")

    def test_new_expense_category_keeps_the_users_words(self):
        result = self.preview({
            "actions": [{
                "intent": "expense", "amount": 42, "date": "2026-10-01",
                "target_id": None, "category_name": "Cat food",
            }],
        })
        self.assertEqual(result["status"], "ready")
        self.assertEqual(result["actions"][0]["target_id"], "")
        self.assertEqual(result["actions"][0]["target_label"], "Cat food")

    def test_category_name_matching_an_existing_choice_reuses_its_id(self):
        result = self.preview({
            "actions": [{
                "intent": "expense", "amount": 12, "date": "2026-10-01",
                "target_id": None, "category_name": "meals",
            }],
        })
        self.assertEqual(result["actions"][0]["target_id"], "21")
        self.assertEqual(result["actions"][0]["target_label"], "Meals")

    def test_new_income_source_keeps_the_users_words_instead_of_defaulting(self):
        result = self.preview({
            "actions": [{
                "intent": "income", "amount": 500, "date": "2026-10-01",
                "target_id": None, "category_name": "Work",
            }],
        })
        self.assertEqual(result["status"], "ready")
        self.assertEqual(result["actions"][0]["target_id"], "")
        self.assertEqual(result["actions"][0]["target_label"], "Work")

    def test_income_source_name_matching_existing_choice_reuses_its_id(self):
        result = self.preview({
            "actions": [{
                "intent": "income", "amount": 500, "date": "2026-10-01",
                "target_id": None, "category_name": "e-hailing",
            }],
        })
        self.assertEqual(result["actions"][0]["target_id"], "11")
        self.assertEqual(result["actions"][0]["target_label"], "E-hailing")

    def test_prompt_says_expense_categories_are_open_ended(self):
        prompt = self.service._prompt(
            "spent 30 on cat food", "en", {"11": "E-hailing"},
            {"21": "Meals", "22": "Other"}, {}, {},
        )
        self.assertIn("suggestions, not closed lists", prompt)
        self.assertIn('Do not replace a clear new value with "Other"', prompt)
        self.assertIn('income from "my work at McDonald\'s" should use "Work"', prompt)
        self.assertIn('confidence is an object', prompt)
        self.assertIn('user\'s own words clearly support', prompt)

    def test_missing_model_confidence_is_treated_as_low(self):
        result = self.preview({
            "actions": [{
                "intent": "income", "amount": 200, "date": "2026-10-01",
                "target_id": "11",
            }],
        })
        self.assertEqual(result["actions"][0]["confidence"], {
            "kind": "low", "amount": "low", "date": "low", "target": "low",
        })

    def test_model_field_confidence_is_preserved(self):
        confidence = {
            "kind": "high", "amount": "high", "date": "high", "target": "low",
        }
        result = self.preview({
            "actions": [{
                "intent": "income", "amount": 200, "date": "2026-10-01",
                "target_id": "11", "confidence": confidence,
            }],
        })
        self.assertEqual(result["actions"][0]["confidence"], confidence)

    def test_missing_amount_requires_clarification(self):
        result = self.preview({
            "actions": [{
                "intent": "bill", "amount": None, "date": None, "target_id": "31",
            }],
        })
        self.assertEqual(result["status"], "needs_clarification")
        self.assertIn("amount", result["message"])

    def test_non_action_falls_back_to_regular_chat(self):
        result = self.preview({"actions": []})
        self.assertEqual(result, {"status": "not_action", "message": "", "actions": []})

    def test_returns_every_action_and_keeps_final_setting_correction(self):
        result = self.preview({"actions": [
            {"intent": "income", "amount": 286.4, "date": "2026-10-01", "target_id": "11"},
            {"intent": "expense", "amount": 12.5, "date": "2026-10-01", "target_id": "21"},
            {"intent": "bill", "amount": 800, "date": None, "target_id": "31"},
            {"intent": "limit", "amount": 1600, "date": None, "target_id": "total"},
            {"intent": "bill", "amount": 850, "date": None, "target_id": "31"},
        ]})
        self.assertEqual(result["status"], "ready")
        self.assertEqual(len(result["actions"]), 4)
        self.assertEqual(result["actions"][-1]["kind"], "bill")
        self.assertEqual(result["actions"][-1]["amount"], "850.00")


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
