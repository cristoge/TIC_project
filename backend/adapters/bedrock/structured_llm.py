from typing import TypeVar

from pydantic import BaseModel
from strands import Agent

from adapters.llm_models import ModelFactory

T = TypeVar("T", bound=BaseModel)


class StrandsStructuredLLM:
    """One-shot structured generation through Strands (no tools, no history).

    The model comes from `model_factory` (see adapters/llm_models.py).
    """

    def __init__(self, model_factory: ModelFactory):
        self.model_factory = model_factory

    def generate(self, instructions: str, content: str, output_type: type[T], temperature: float) -> T:
        agent = Agent(model=self.model_factory(temperature), system_prompt=instructions, callback_handler=None)
        return agent(content, structured_output_model=output_type).structured_output
