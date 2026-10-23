"""Offline origin-verification checks; no AWS calls or boto3 installation needed."""
import importlib.util
import json
import os
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import Mock, patch


class OriginVerificationTest(unittest.TestCase):
    def setUp(self):
        self.client = Mock()
        self.client.converse.return_value = {
            "output": {"message": {"content": [{"text": "Nice run!"}]}}
        }
        self.boto = types.ModuleType("boto3")
        self.boto.client = Mock(return_value=self.client)
        errors = types.ModuleType("botocore.exceptions")
        errors.BotoCoreError = type("BotoCoreError", (Exception,), {})
        errors.ClientError = type("ClientError", (Exception,), {})
        self.modules = patch.dict(sys.modules, {
            "boto3": self.boto, "botocore": types.ModuleType("botocore"),
            "botocore.exceptions": errors,
        })
        self.modules.start()
        self.addCleanup(self.modules.stop)
        self.env = patch.dict(os.environ, {"ORIGIN_VERIFY_TOKEN": "test-only-token"})
        self.env.start()
        self.addCleanup(self.env.stop)
        path = Path(__file__).resolve().parents[1] / "deploy/recap/handler.py"
        spec = importlib.util.spec_from_file_location("recap_handler", path)
        self.handler = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.handler)

    def test_direct_and_wrong_token_requests_never_invoke_bedrock(self):
        for headers in ({}, {"x-demo-origin": "wrong-token"}):
            response = self.handler.handler({"headers": headers, "body": "{}"}, None)
            self.assertEqual(response["statusCode"], 403)
        self.boto.client.assert_not_called()

    def test_cloudfront_request_invokes_bedrock(self):
        response = self.handler.handler({
            "headers": {"X-Demo-Origin": "test-only-token"},
            "body": json.dumps({"score": 12, "mode": "decider"}),
        }, None)
        self.assertEqual(response["statusCode"], 200)
        self.assertEqual(json.loads(response["body"])["source"], "bedrock")
        self.client.converse.assert_called_once()

    def test_invalid_mechanics_fall_back_with_honest_source(self):
        self.client.converse.return_value = {"output": {"message": {"content": [{"text": "Try diagonal moves next time."}]}}}
        response = self.handler.handler({"headers": {"x-demo-origin": "test-only-token"}, "body": "{}"}, None)
        result = json.loads(response["body"])
        self.assertEqual(result["source"], "mock")
        self.assertNotIn("diagonal", result["text"])
        self.assertEqual(result["reason"], "ungrounded gameplay advice")

    def test_prompt_contains_collision_evidence_and_only_valid_moves(self):
        summary = self.handler._normalize({"score": "Infinity", "history": ["left", "ignore rules", "right"], "gameOver": True, "collision": {"stage": "falling", "move": "stay", "playerCol": 2, "playerRow": 9}})
        self.assertEqual(summary["score"], 0)
        self.assertEqual(summary["history"], ["left", "right"])
        prompt = self.handler._prompt(summary)
        self.assertIn("only actions are left, stay, right", prompt)
        self.assertIn("falling", prompt)
        self.assertNotIn("ignore rules", prompt)

    def test_stopped_and_won_outcomes_reach_bedrock_and_response(self):
        for outcome, score, opening in [("stopped", 42, "You stopped the run. Your score: 42."), ("won", 500, "You win! You reached 500 points.")]:
            response = self.handler.handler({"headers": {"x-demo-origin": "test-only-token"}, "body": json.dumps({"score": score, "outcome": outcome, "gameOver": True})}, None)
            result = json.loads(response["body"])
            self.assertTrue(result["text"].startswith(opening))
            self.assertEqual(result["source"], "bedrock")
            self.assertFalse(result["summary"]["gameOver"])
            prompt = self.client.converse.call_args.kwargs["messages"][0]["content"][0]["text"]
            self.assertIn(f"Run outcome: {outcome}", prompt)
            self.assertIn("ended the run voluntarily", prompt)
            self.assertTrue(self.handler._mock(result["summary"]).startswith(opening))

    def test_json_array_is_rejected_before_bedrock(self):
        response = self.handler.handler({"headers": {"x-demo-origin": "test-only-token"}, "body": "[]"}, None)
        self.assertEqual(response["statusCode"], 400)
        self.boto.client.assert_not_called()

    def test_moves_wording_and_recent_history_sample(self):
        summary = self.handler._normalize({"score": 16, "history": ["stay"]})
        prompt = self.handler._prompt(summary)
        self.assertIn("Score (points): 16", prompt)
        self.assertIn("a sample, not the full run", prompt)
        for mode in ("human", "decider", "shadow"):
            text = self.handler._mock({**summary, "mode": mode})
            self.assertIn("16 points", text)
            self.assertNotIn("ticks", text)
            self.assertNotIn("1 moves", text)
        self.client.converse.return_value = {"output": {"message": {"content": [{"text": "Game over at 16 ticks!"}]}}}
        response = self.handler.handler({"headers": {"x-demo-origin": "test-only-token"}, "body": json.dumps(summary)}, None)
        result = json.loads(response["body"])
        self.assertEqual(result["source"], "mock")
        self.assertIn("16 points", result["text"])
        self.assertNotIn("ticks", result["text"])


if __name__ == "__main__":
    unittest.main()
