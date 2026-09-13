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
# Google retires models for *new* keys before removing them for existing ones,
# so a model that works on one account 404s on another created a week later.
# gemini-2.5-flash is one of those: still served for older keys, "no longer
# available to new users" for fresh ones. The 404 names the replacement, and
# doctor.py surfaces it, so a future retirement is a one-line change here.
GEMINI_MODEL = _env("GEMINI_MODEL", "gemini-3.6-flash")
# Embeddings are a different model from the one that writes answers, and a
# different shape of thing: a fixed-width vector, not text. The dimension is
# baked into the pgvector column, so changing this model means rebuilding the
# index — vector_store records which model wrote each row so that a change is
# caught rather than silently mixing two incompatible vector spaces.
GEMINI_EMBED_MODEL = _env("GEMINI_EMBED_MODEL", "text-embedding-004")
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
OLLAMA_EMBED_MODEL = _env("OLLAMA_EMBED_MODEL", "nomic-embed-text")

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

    # -------------------------------------------------------- embeddings ---

    embed_model = ""

    def can_embed(self) -> bool:
        """
        Whether this provider offers an embeddings API at all.

        Not every one does — Anthropic publishes no embeddings endpoint — and
        that is a different thing from being unconfigured. Retrieval asks this
        before it offers itself, so the reason it stayed off can be specific.
        """
        return bool(self.embed_model)

    def embed(self, texts: list[str]) -> list[list[float]]:
        """Embed each text, in order. One request where the API allows it."""
        raise ProviderError(f"{self.name} has no embeddings API.")


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


    # Gemini batches embeddings, so a whole document goes in one request
    # instead of one per chunk — which is the difference between a backfill
    # that takes a minute and one that takes an hour on a free-tier quota.
    embed_model = GEMINI_EMBED_MODEL

    def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        qualified = f"models/{self.embed_model}"
        data = _post_json(
            f"{self.endpoint}/{self.embed_model}:batchEmbedContents",
            {
                "requests": [
                    {"model": qualified, "content": {"parts": [{"text": text}]}}
                    for text in texts
                ]
            },
            {"x-goog-api-key": GEMINI_API_KEY},
        )
        vectors = [
            [float(v) for v in (item or {}).get("values") or []]
            for item in data.get("embeddings") or []
        ]
        if len(vectors) != len(texts) or any(not v for v in vectors):
            # A short or ragged batch would otherwise be written to the index
            # misaligned, pairing each chunk with its neighbour's vector.
            raise ProviderError(
                f"Gemini returned {len(vectors)} embeddings for {len(texts)} inputs."
            )
        return vectors


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
    # Ollama embeds one input per request, so this loops. That is fine for a
    # local server and the reason Gemini is the default in production.
    embed_model = OLLAMA_EMBED_MODEL

    def embed(self, texts: list[str]) -> list[list[float]]:
        vectors = []
        for text in texts:
            data = _post_json(
                f"{self.host}/api/embeddings",
                {"model": self.embed_model, "prompt": text},
            )
            values = [float(v) for v in data.get("embedding") or []]
            if not values:
                raise ProviderError(
                    f"Ollama returned no embedding for {self.embed_model}. "
                    f"Pull it first: ollama pull {self.embed_model}"
                )
            vectors.append(values)
        return vectors


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


def embed(texts: list[str]) -> list[list[float]]:
    """
    Embed texts with the active provider.

    Raises ProviderError when there is no provider, or when the one in play
    has no embeddings API — the same single failure path complete() gives, so
    retrieval has one thing to catch and one place to fall back from.
    """
    if ACTIVE_PROVIDER is None:
        raise ProviderError(MOCK_REASON or "No AI provider is configured.")
    if not ACTIVE_PROVIDER.can_embed():
        raise ProviderError(f"{ACTIVE_PROVIDER.name} has no embeddings API.")
    return ACTIVE_PROVIDER.embed(texts)


def embeddings_describe() -> dict:
    """
    Whether semantic retrieval can be fed, and by what.

    `reason` is set only when it cannot, so /health can say which of the two
    reasons applies: no provider at all, or a provider that does not embed.
    """
    if ACTIVE_PROVIDER is None:
        return {"available": False, "provider": None, "model": None, "reason": MOCK_REASON}
    if not ACTIVE_PROVIDER.can_embed():
        return {
            "available": False,
            "provider": ACTIVE_PROVIDER.name,
            "model": None,
            "reason": f"{ACTIVE_PROVIDER.name} has no embeddings API.",
        }
    return {
        "available": True,
        "provider": ACTIVE_PROVIDER.name,
        "model": ACTIVE_PROVIDER.embed_model,
        "reason": None,
    }


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
