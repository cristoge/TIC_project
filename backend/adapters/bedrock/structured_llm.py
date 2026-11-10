from typing import TypeVar

from pydantic import BaseModel
from strands import Agent
from strands.models import BedrockModel

NOVA_2_LITE = "eu.amazon.nova-2-lite-v1:0"

T = TypeVar("T", bound=BaseModel)


class StrandsStructuredLLM:
    """One-shot structured generation through Strands on Bedrock (no tools, no history)."""

    def __init__(self, model_id: str = NOVA_2_LITE, region_name: str | None = None, boto_client_config=None):
        self.model_id = model_id
        self.region_name = region_name
        self.boto_client_config = boto_client_config

    def generate(self, instructions: str, content: str, output_type: type[T], temperature: float) -> T:
        model = BedrockModel(
            model_id=self.model_id,
            temperature=temperature,
            region_name=self.region_name,
            boto_client_config=self.boto_client_config,
        )
        agent = Agent(model=model, system_prompt=instructions, callback_handler=None)
        return agent(content, structured_output_model=output_type).structured_output
