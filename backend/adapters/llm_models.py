"""Strands model factories: given a temperature, build the model for one call.

Bedrock (Nova 2 Lite) in AWS; DeepSeek through its OpenAI-compatible API in local mode.
"""

from collections.abc import Callable

from strands.models import BedrockModel, Model
from strands.models.openai import OpenAIModel

NOVA_2_LITE = "eu.amazon.nova-2-lite-v1:0"
DEEPSEEK_BASE_URL = "https://api.deepseek.com"
DEEPSEEK_FLASH = "deepseek-flash"

ModelFactory = Callable[[float], Model]


def bedrock_model_factory(model_id: str = NOVA_2_LITE, region_name: str | None = None, boto_client_config=None) -> ModelFactory:
    def create(temperature: float) -> Model:
        return BedrockModel(
            model_id=model_id, temperature=temperature, region_name=region_name, boto_client_config=boto_client_config
        )

    return create


def deepseek_model_factory(api_key: str, model_id: str = DEEPSEEK_FLASH, base_url: str = DEEPSEEK_BASE_URL) -> ModelFactory:
    def create(temperature: float) -> Model:
        return OpenAIModel(
            client_args={"api_key": api_key, "base_url": base_url},
            model_id=model_id,
            # Same settings as the user's other DeepSeek project: no reasoning tokens, direct answers.
            params={"temperature": temperature, "extra_body": {"thinking": {"type": "disabled"}}},
        )

    return create
