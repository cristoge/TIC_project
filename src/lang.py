from typing import Literal
from langchain.tools import tool
from langchain_ollama import ChatOllama
import operator
from langgraph.graph import END, StateGraph, START
from typing_extensions import TypedDict, Annotated
from langchain.messages import AnyMessage, SystemMessage, ToolMessage, HumanMessage

model = ChatOllama(model="qwen2:7b", temperature=0)


class MessagesState(TypedDict):
    messages: Annotated[list[AnyMessage], operator.add]
    llm_calls: int


def should_continue(state: MessagesState) -> Literal["tool_node", END]:
    """Decide if we should continue the loop or stop based upon whether the LLM made a tool call"""

    messages = state["messages"]
    last_message = messages[-1]

    # If the LLM makes a tool call, then perform an action
    if last_message.tool_calls:
        return "tool_node"

    # Otherwise, we stop (reply to the user)
    return END


# Define tools
@tool
def get_object_topic(name: str) -> str:
    """Returns a topic to be described by the LLM."""

    return f"Explica de forma clara y precisa qué es: {name}"


# Augment the LLM with tools
tools = [get_object_topic]
tools_by_name = {tool.name: tool for tool in tools}
model_with_tools = model.bind_tools(tools)


def llm_call(state: dict):
    """LLM decides whether to call a tool or not"""

    return {
        "messages": [
            model_with_tools.invoke(
                [
                    SystemMessage(
                        content="""
Eres un asistente que responde SIEMPRE en español.

Explica todo de forma clara, precisa y educativa en español.

Nunca respondas en inglés.
"""
                    )
                ]
                + state["messages"]
            )
        ],
        "llm_calls": state.get("llm_calls", 0) + 1,
    }


def tool_node(state: dict):
    """Performs the tool call"""

    result = []
    for tool_call in state["messages"][-1].tool_calls:
        tool = tools_by_name[tool_call["name"]]
        observation = tool.invoke(tool_call["args"])
        result.append(ToolMessage(content=observation, tool_call_id=tool_call["id"]))
    return {"messages": result}


# Build workflow
agent_builder = StateGraph(MessagesState)

# Add nodes
agent_builder.add_node("llm_call", llm_call)
agent_builder.add_node("tool_node", tool_node)

# Add edges to connect nodes
agent_builder.add_edge(START, "llm_call")
agent_builder.add_conditional_edges("llm_call", should_continue, ["tool_node", END])
agent_builder.add_edge("tool_node", "llm_call")

# Compile the agent
agent = agent_builder.compile()

# Show the agent
# Invoke

while True:
    user_input = input("Input: ")

    if user_input.lower() in ["exit", "quit"]:
        break

    messages = [HumanMessage(content=user_input)]
    result = agent.invoke({"messages": messages})

    print("\n Agente:")
    for m in result["messages"]:
        m.pretty_print()
