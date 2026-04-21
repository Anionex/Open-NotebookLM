from __future__ import annotations


def ensure_langgraph_compat() -> None:
    """Patch old langchain-core installs so current langgraph can import."""
    import langchain_core.messages as messages_module
    import langchain_core.messages.utils as message_utils_module
    import langchain_core.runnables.config as config_module

    if hasattr(messages_module, "RemoveMessage"):
        pass
    else:
        from langchain_core.messages import BaseMessage

        class RemoveMessage(BaseMessage):
            type: str = "remove"

            def __init__(self, content: str = "", **kwargs):
                super().__init__(content=content, **kwargs)

        messages_module.RemoveMessage = RemoveMessage

    runnable_config_keys = tuple(getattr(config_module, "RunnableConfig", {}).__annotations__.keys())
    if not hasattr(config_module, "CONFIG_KEYS"):
        config_module.CONFIG_KEYS = runnable_config_keys

    if not hasattr(config_module, "COPIABLE_KEYS"):
        default_copiable = (
            "tags",
            "metadata",
            "callbacks",
            "configurable",
        )
        config_module.COPIABLE_KEYS = tuple(
            key for key in default_copiable if key in runnable_config_keys
        )

    if not hasattr(message_utils_module, "trim_messages"):
        def trim_messages(
            messages,
            *,
            strategy="last",
            max_tokens=None,
            token_counter=len,
            start_on=None,
            end_on=None,
            **kwargs,
        ):
            if max_tokens is None:
                return list(messages)

            items = list(messages)
            if strategy == "first":
                selected = []
                total = 0
                for message in items:
                    cost = token_counter(message)
                    if total + cost > max_tokens:
                        break
                    selected.append(message)
                    total += cost
                return selected

            selected = []
            total = 0
            for message in reversed(items):
                cost = token_counter(message)
                if total + cost > max_tokens:
                    break
                selected.append(message)
                total += cost
            selected.reverse()
            return selected

        message_utils_module.trim_messages = trim_messages
