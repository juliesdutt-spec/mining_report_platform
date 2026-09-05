"""
Which model answers a prompt, and how to reach it.

Every AI feature in this platform is the same shape: build a prompt, get text
back. That is the whole contract a provider has to satisfy, so this module is
one `complete()` method behind four transports:

    claude      Anthropic API              (paid)
    gemini      Google Gemini API          (has a free tier)
    openrouter  OpenRouter, OpenAI-shaped  (has free models)
    ollama      a local Ollama server      (free, offline, no key)

`ai_extractor` builds the prompts and falls back to its deterministic mock
answers whenever no provider is configured or a call fails, so the platform
runs with no key at all — the provider is what makes the answers real, not
what makes the app work.

Transports are stdlib `urllib` on purpose: adding a provider must not add a
dependency. The Anthropic SDK is used when it is installed because the project
already depends on it, but Claude works through the same REST path without it.

Keys are read from the environment, never logged, never returned, and scrubbed
out of any error text before it can reach a response body or a console.
"""
import json
import os
import urllib.error
import urllib.parse
import urllib.request

# Populates os.environ from .env before any getenv below runs.
import utils.env  # noqa: F401


class ProviderError(RuntimeError):
    """A provider was asked for a completion and could not produce one."""


# ---------------------------------------------------------------- config ---

def _env(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip()


CLAUDE_API_KEY = _env("CLAUDE_API_KEY")
CLAUDE_MODEL = _env("CLAUDE_MODEL", "claude-opus-5")

GEMINI_API_KEY = _env("GEMINI_API_KEY") or _env("GOOGLE_API_KEY")
GEMINI_MODEL = _env("GEMINI_MODEL", "gemini-2.5-flash")
# Overridable for regional endpoints and corporate proxies.
GEMINI_BASE_URL = _env(
    "GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta"
).rstrip("/")

OPENROUTER_API_KEY = _env("OPENROUTER_API_KEY")
# Deliberately no default: OpenRouter's free model ids rotate as providers add
# and drop promotions, so a baked-in guess would 404 on someone's first call.
# Better to say which variable is missing and where the live list is.
OPENROUTER_MODEL = _env("OPENROUTER_MODEL")
# Any OpenAI-compatible server works here - LM Studio, vLLM, LiteLLM, Groq -
# which is why this provider is the escape hatch for endpoints we do not name.
OPENROUTER_BASE_URL = _env(
    "OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"
).rstrip("/")

OLLAMA_HOST = _env("OLLAMA_HOST", "http://localhost:11434").rstrip("/")
OLLAMA_MODEL = _env("OLLAMA_MODEL", "llama3.2")

FORCE_MOCK = _env("USE_MOCK_AI", "false").lower() == "true"
REQUESTED_PROVIDER = _env("AI_PROVIDER", "auto").lower()

HTTP_TIMEOUT = int(_env("AI_TIMEOUT_SECONDS", "90") or "90")

#: Every secret this module knows about, for scrubbing error text.
_SECRETS = [s for s in (CLAUDE_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY) if s]


def _redact(text: str) -> str:
    """Remove any configured key from text before it is shown or logged."""
    for secret in _SECRETS:
        if secret and secret in text:
            text = text.replace(secret, "***")
    return text


def _origin(url: str) -> str:
    """Host of a URL, without the path or query a key might be sitting in."""
    parts = urllib.parse.urlsplit(url)
    return f"{parts.scheme}://{parts.netloc}"


# ------------------------------------------------------------- transport ---

def _post_json(url: str, payload: dict, headers: dict | None = None) -> dict:
    """POST JSON, return parsed JSON, raise ProviderError with a safe message."""
    request = urllib.request.Request(
        url, data=json.dumps(payload).encode("utf-8"), method="POST"
    )
    request.add_header("Content-Type", "application/json")
    for key, value in (headers or {}).items():
        request.add_header(key, value)

    try:
        with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", "replace")[:400]
        raise ProviderError(
            _redact(f"HTTP {exc.code} from {_origin(url)}: {body}")
        ) from None
    except urllib.error.URLError as exc:
        raise ProviderError(
            _redact(f"Could not reach {_origin(url)}: {exc.reason}")
        ) from None
    except json.JSONDecodeError:
        raise ProviderError(f"{_origin(url)} returned a non-JSON response") from None


# ------------------------------------------------------------- providers ---

class Provider:
    """A named model endpoint that turns a prompt into text."""

    name = "provider"
    model = ""

    def is_configured(self) -> bool:
        """True when this provider has everything it needs to be called."""
        raise NotImplementedError

    def unconfigured_reason(self) -> str:
        """Why is_configured() is False, phrased for an operator."""
        raise NotImplementedError

    def started_configuring(self) -> bool:
        """
        True when the environment shows clear intent to use this provider,
        even though it is not usable yet.

        Auto-selection reports the gap of a half-configured provider rather
        than the generic "nothing is set up" message: someone who supplied a
        key and forgot the model id needs to be told about the model id.
        """
        return self.is_configured()

    def complete(self, prompt: str, max_tokens: int = 1000) -> str:
        raise NotImplementedError


class ClaudeProvider(Provider):
    """Anthropic's API, through the SDK when installed and REST when not."""

    name = "claude"

    def __init__(self) -> None:
        self.model = CLAUDE_MODEL

    def is_configured(self) -> bool:
        return bool(CLAUDE_API_KEY)

    def unconfigured_reason(self) -> str:
        return "CLAUDE_API_KEY is not set."

    def complete(self, prompt: str, max_tokens: int = 1000) -> str:
        try:
            import anthropic
        except ImportError:
            return self._complete_over_rest(prompt, max_tokens)

        try:
            client = anthropic.Anthropic(api_key=CLAUDE_API_KEY)
            response = client.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                messages=[{"role": "user", "content": prompt}],
            )
            return response.content[0].text.strip()
        except Exception as exc:  # SDK raises its own exception hierarchy
            raise ProviderError(_redact(f"Claude API error: {exc}")) from None

    def _complete_over_rest(self, prompt: str, max_tokens: int) -> str:
        data = _post_json(
            "https://api.anthropic.com/v1/messages",
            {
                "model": self.model,
                "max_tokens": max_tokens,
                "messages": [{"role": "user", "content": prompt}],
            },
            {"x-api-key": CLAUDE_API_KEY, "anthropic-version": "2023-06-01"},
        )
        blocks = data.get("content") or []
        if not blocks:
            raise ProviderError("Claude returned an empty response.")
        return str(blocks[0].get("text", "")).strip()


class GeminiProvider(Provider):
    """Google's Gemini API. The key travels in a header, never in the URL."""

    name = "gemini"

    def __init__(self) -> None:
        self.model = GEMINI_MODEL
        self.endpoint = f"{GEMINI_BASE_URL}/models"

    def is_configured(self) -> bool:
        return bool(GEMINI_API_KEY)

    def unconfigured_reason(self) -> str:
        return "GEMINI_API_KEY is not set."

    def complete(self, prompt: str, max_tokens: int = 1000) -> str:
        data = _post_json(
            f"{self.endpoint}/{self.model}:generateContent",
            {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"maxOutputTokens": max_tokens},
            },
            {"x-goog-api-key": GEMINI_API_KEY},
        )

        candidates = data.get("candidates") or []
        if not candidates:
            # A prompt Gemini declines to answer comes back with no candidates
            # and a reason worth surfacing rather than swallowing.
            blocked = (data.get("promptFeedback") or {}).get("blockReason")
            raise ProviderError(
                f"Gemini returned no candidates ({blocked or 'no reason given'})."
            )

        parts = (candidates[0].get("content") or {}).get("parts") or []
        text = "".join(str(part.get("text", "")) for part in parts).strip()
        if not text:
            raise ProviderError("Gemini returned an empty response.")
        return text


class OpenRouterProvider(Provider):
    """OpenRouter's OpenAI-compatible endpoint, including its free models."""

    name = "openrouter"
    FREE_MODELS_URL = "https://openrouter.ai/models?max_price=0"

    def __init__(self) -> None:
        self.model = OPENROUTER_MODEL
        self.endpoint = f"{OPENROUTER_BASE_URL}/chat/completions"

    def is_configured(self) -> bool:
        return bool(OPENROUTER_API_KEY and OPENROUTER_MODEL)

    def unconfigured_reason(self) -> str:
        if not OPENROUTER_API_KEY:
            return "OPENROUTER_API_KEY is not set."
        return (
            "OPENROUTER_MODEL is not set. Free model ids change over time - "
            f"pick a current one from {self.FREE_MODELS_URL} (they end in ':free')."
        )

    def started_configuring(self) -> bool:
        # A key with no model id is the common half-finished setup here.
        return bool(OPENROUTER_API_KEY)

    def complete(self, prompt: str, max_tokens: int = 1000) -> str:
        data = _post_json(
            self.endpoint,
            {
                "model": self.model,
                "max_tokens": max_tokens,
                "messages": [{"role": "user", "content": prompt}],
            },
            {"Authorization": f"Bearer {OPENROUTER_API_KEY}"},
        )

        # OpenRouter reports upstream provider failures as a 200 with an error
        # body, so a missing `choices` is the normal failure path, not a bug.
        if "choices" not in data:
            message = (data.get("error") or {}).get("message", "no choices returned")
            raise ProviderError(_redact(f"OpenRouter error: {message}"))

        choices = data.get("choices") or []
        if not choices:
            raise ProviderError("OpenRouter returned an empty response.")
        return str((choices[0].get("message") or {}).get("content", "")).strip()


class OllamaProvider(Provider):
    """A local Ollama server. No key, no network, no cost."""

    name = "ollama"

    def __init__(self) -> None:
        self.model = OLLAMA_MODEL
        self.host = OLLAMA_HOST

    def is_configured(self) -> bool:
        # Reachability is not probed here — a blocking network call at import
        # time would stall startup. Selecting ollama is the operator's
        # statement that it is running; a failed call falls back to mock.
        return bool(self.model and self.host)

    def unconfigured_reason(self) -> str:
        return "OLLAMA_MODEL or OLLAMA_HOST is empty."

    def complete(self, prompt: str, max_tokens: int = 1000) -> str:
        data = _post_json(
            f"{self.host}/api/chat",
            {
                "model": self.model,
                "messages": [{"role": "user", "content": prompt}],
                "stream": False,
                "options": {"num_predict": max_tokens},
            },
        )
        text = str((data.get("message") or {}).get("content", "")).strip()
        if not text:
            raise ProviderError(
                f"Ollama returned nothing. Is '{self.model}' pulled? "
                f"Run: ollama pull {self.model}"
            )
        return text


#: Auto-detection order. Claude first so an existing paid setup keeps working,
#: then the providers with a free tier, then the local one.
PROVIDERS = {
    "claude": ClaudeProvider,
    "gemini": GeminiProvider,
    "openrouter": OpenRouterProvider,
    "ollama": OllamaProvider,
}
AUTO_ORDER = ["claude", "gemini", "openrouter", "ollama"]


# -------------------------------------------------------------- resolving ---

def _resolve() -> tuple[Provider | None, str | None]:
    """
    Pick the provider to use.

    Returns (provider, reason_for_mock). A None provider means mock mode, and
    the reason says why, so /health can explain it without exposing anything.
    """
    if FORCE_MOCK:
        return None, "USE_MOCK_AI is set to true, which forces mock mode."

    if REQUESTED_PROVIDER in ("mock", "none"):
        return None, "AI_PROVIDER is set to mock."

    if REQUESTED_PROVIDER not in ("auto", ""):
        factory = PROVIDERS.get(REQUESTED_PROVIDER)
        if factory is None:
            known = ", ".join(sorted(PROVIDERS))
            return None, f"AI_PROVIDER '{REQUESTED_PROVIDER}' is not one of: {known}, mock."
        provider = factory()
        if not provider.is_configured():
            return None, provider.unconfigured_reason()
        return provider, None

    # auto: first configured provider wins.
    half_configured: str | None = None
    for name in AUTO_ORDER:
        provider = PROVIDERS[name]()
        # Ollama needs no key, so in auto mode it would always match and
        # silently win. It is only auto-selected when explicitly pointed at.
        if name == "ollama" and not (_env("OLLAMA_HOST") or _env("OLLAMA_MODEL")):
            continue
        if provider.is_configured():
            return provider, None
        if half_configured is None and provider.started_configuring():
            half_configured = provider.unconfigured_reason()

    if half_configured:
        return None, half_configured

    return None, (
        "No AI provider is configured. Set one of GEMINI_API_KEY (free tier), "
        "OPENROUTER_API_KEY (free models) or CLAUDE_API_KEY, or run Ollama and "
        "set AI_PROVIDER=ollama."
    )


ACTIVE_PROVIDER, MOCK_REASON = _resolve()
USE_MOCK = ACTIVE_PROVIDER is None


def complete(prompt: str, max_tokens: int = 1000) -> str:
    """
    Complete a prompt with the active provider.

    Raises ProviderError in mock mode too, so callers have one failure path to
    handle: they catch it and use their mock answer.
    """
    if ACTIVE_PROVIDER is None:
        raise ProviderError(MOCK_REASON or "No AI provider is configured.")
    return ACTIVE_PROVIDER.complete(prompt, max_tokens)


def describe() -> dict:
    """
    What an operator needs to confirm their configuration took effect.

    Names the provider and model in play and, in mock mode, why. Never
    includes a key or any part of one.
    """
    return {
        "mode": "mock" if USE_MOCK else ACTIVE_PROVIDER.name,
        "model": None if USE_MOCK else ACTIVE_PROVIDER.model,
        "reason": MOCK_REASON,
        "requested": REQUESTED_PROVIDER or "auto",
        "available": sorted(PROVIDERS),
    }
