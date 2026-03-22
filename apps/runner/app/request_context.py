"""Per-request context using contextvars.

Sets the user's OpenAI API key for the duration of a request so that
LLM and vision clients can pick it up without explicit parameter threading.
The key is used solely in the Authorization header when calling OpenAI —
it is never included in prompts or model inputs.
"""

from contextvars import ContextVar

# When set, LLM and vision calls use this key instead of the global one.
# Embeddings always use the global key (shared triage memory corpus).
openai_api_key_var: ContextVar[str | None] = ContextVar("openai_api_key", default=None)
