from typing import TypeVar

from pydantic import BaseModel
from strands import Agent

from adapters.llm_models import NOVA_2_LITE, ModelFactory, bedrock_model_factory

__all__ = ["NOVA_2_LITE", "StrandsStructuredLLM"]

T = TypeVar("T", bound=BaseModel)


class StrandsStructuredLLM:
    """One-shot structured generation through Strands (no tools, no history).

    The model comes from `model_factory` (Nova on Bedrock by default, DeepSeek in local mode).
    """

    def __init__(self, model_factory: ModelFactory | None = None, boto_client_config=None, region_name: str | None = None):
        self.model_factory = model_factory or bedrock_model_factory(
            region_name=region_name, boto_client_config=boto_client_config
        )

    def generate(self, instructions: str, content: str, output_type: type[T], temperature: float) -> T:
        agent = Agent(model=self.model_factory(temperature), system_prompt=instructions, callback_handler=None)
        return agent(content, structured_output_model=output_type).structured_output
