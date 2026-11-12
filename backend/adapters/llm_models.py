"""Strands model factories: given a temperature, build the model for one call.

The model is chosen with LLM_MODEL as "<provider>/<model>", e.g. "deepseek/deepseek-flash"
or "ollama/qwen3:8b"; that same text labels what the study artifacts were generated with.
"""

from collections.abc import Callable, Mapping

from strands.models import Model
from strands.models.ollama import OllamaModel
from strands.models.openai import OpenAIModel

DEEPSEEK_BASE_URL = "https://api.deepseek.com"
DEEPSEEK_FLASH = "deepseek-flash"
DEFAULT_LLM_MODEL = f"deepseek/{DEEPSEEK_FLASH}"
DEFAULT_OLLAMA_URL = "http://localhost:11434"

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


def model_factory_from(spec: str, env: Mapping[str, str]) -> ModelFactory:
    """Build the factory for an LLM_MODEL value; provider settings come from `env`."""
    provider, _, model_id = spec.partition("/")
    if provider == "deepseek" and model_id:
        if not env.get("DEEPSEEK_API_KEY"):
            raise ValueError("DEEPSEEK_API_KEY is required for deepseek models.")
        return deepseek_model_factory(env["DEEPSEEK_API_KEY"], model_id=model_id)
    if provider == "ollama" and model_id:
        return ollama_model_factory(model_id, host=env.get("OLLAMA_URL", DEFAULT_OLLAMA_URL))
    raise ValueError(f"LLM_MODEL must look like 'deepseek/<model>' or 'ollama/<model>', got {spec!r}.")
