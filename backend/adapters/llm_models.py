"""Strands model factories: given a temperature, build the model for one call.

The model is chosen with LLM_MODEL as "<provider>/<model>", e.g. "deepseek/deepseek-flash",
"ollama/qwen3:8b", "openai/gpt-5" or "anthropic/claude-sonnet-5-5"; that same text labels what
the study artifacts were generated with.
"""

from collections.abc import Callable, Mapping

from strands.models import Model
from strands.models.anthropic import AnthropicModel
from strands.models.ollama import OllamaModel
from strands.models.openai import OpenAIModel

DEEPSEEK_BASE_URL = "https://api.deepseek.com"
DEEPSEEK_FLASH = "deepseek-flash"
DEFAULT_LLM_MODEL = f"deepseek/{DEEPSEEK_FLASH}"
DEFAULT_OLLAMA_URL = "http://localhost:11434"
OPENAI_BASE_URL = "https://api.openai.com/v1"
CLAUDE_MAX_TOKENS = 16000  # the Claude API requires a cap; this one leaves room for long summaries

ModelFactory = Callable[[float], Model]


def deepseek_model_factory(api_key: str, model_id: str = DEEPSEEK_FLASH, base_url: str = DEEPSEEK_BASE_URL) -> ModelFactory:
    def create(temperature: float) -> Model:
        return OpenAIModel(
            client_args={"api_key": api_key, "base_url": base_url},
            model_id=model_id,
            # Same settings as the user's other DeepSeek project: no reasoning tokens, direct answers.
            params={"temperature": temperature, "extra_body": {"thinking": {"type": "disabled"}}},
        )

    return create


def ollama_model_factory(model_id: str, host: str = DEFAULT_OLLAMA_URL) -> ModelFactory:
    def create(temperature: float) -> Model:
        return OllamaModel(host, model_id=model_id, temperature=temperature)

    return create


def openai_model_factory(model_id: str, api_key: str, base_url: str = OPENAI_BASE_URL) -> ModelFactory:
    """Any OpenAI-compatible API: OpenAI itself, OpenRouter, LM Studio, vLLM, Ollama's /v1..."""

    def create(temperature: float) -> Model:
        return OpenAIModel(
            client_args={"api_key": api_key, "base_url": base_url},
            model_id=model_id,
            params={"temperature": temperature},
        )

    return create


def anthropic_model_factory(model_id: str, api_key: str | None = None) -> ModelFactory:
    """Claude. The temperature is not sent: current Claude models reject sampling parameters.

    Without `api_key` the Anthropic SDK finds the credentials itself (e.g. an `ant auth login` profile).
    """
    client_args = {"api_key": api_key} if api_key else {}

    def create(temperature: float) -> Model:
        return AnthropicModel(client_args=client_args, model_id=model_id, max_tokens=CLAUDE_MAX_TOKENS)

    return create


def model_factory_from(spec: str, env: Mapping[str, str]) -> ModelFactory:
    """Build the factory for an LLM_MODEL value; provider settings come from `env`."""
    provider, _, model_id = spec.partition("/")
    if provider == "deepseek" and model_id:
        if not env.get("DEEPSEEK_API_KEY"):
            raise ValueError("DEEPSEEK_API_KEY is required for deepseek models.")
        return deepseek_model_factory(env["DEEPSEEK_API_KEY"], model_id=model_id)
    if provider == "ollama" and model_id:
        return ollama_model_factory(model_id, host=env.get("OLLAMA_URL", DEFAULT_OLLAMA_URL))
    if provider == "openai" and model_id:
        base_url = env.get("OPENAI_BASE_URL")
        if not base_url and not env.get("OPENAI_API_KEY"):
            raise ValueError("OPENAI_API_KEY is required for the OpenAI API (or set OPENAI_BASE_URL for a local server).")
        # Local OpenAI-compatible servers ignore the key, but the client requires one.
        return openai_model_factory(model_id, env.get("OPENAI_API_KEY") or "not-needed", base_url or OPENAI_BASE_URL)
    if provider == "anthropic" and model_id:
        return anthropic_model_factory(model_id, api_key=env.get("ANTHROPIC_API_KEY"))
    raise ValueError(
        "LLM_MODEL must look like '<provider>/<model>' with provider deepseek, ollama, openai or anthropic, "
        f"got {spec!r}."
    )
