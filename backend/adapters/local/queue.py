"""Local stand-in for the SQS generation queue: jobs run in background threads of the API process."""

import logging
from collections.abc import Callable
from concurrent.futures import Executor, ThreadPoolExecutor

logger = logging.getLogger(__name__)


class InProcessJobQueue:
    def __init__(self, runners: dict[str, Callable[[str], object]], executor: Executor | None = None):
        self.runners = runners
        self.executor = executor or ThreadPoolExecutor(max_workers=2, thread_name_prefix="generation")

    def enqueue(self, kind: str, generation_id: str) -> None:
        future = self.executor.submit(self.runners[kind], generation_id)
        future.add_done_callback(lambda f: self._log_failure(f, kind, generation_id))

    @staticmethod
    def _log_failure(future, kind: str, generation_id: str) -> None:
        # The service already stored the failure on the row; the log is for the developer.
        if future.exception() is not None:
            logger.error("Generating %s %s failed", kind, generation_id, exc_info=future.exception())
