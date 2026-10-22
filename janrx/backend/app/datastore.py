import json
from pathlib import Path
from typing import Any

from .errors import ApiError

FILES = ("brands", "janaushadhi_products", "kendras")


class DataStore:
    def __init__(self, data_dir: str) -> None:
        self.dir = Path(data_dir)
        self._cache: dict[str, list[dict[str, Any]]] = {}

    def _resolve_path(self, name: str) -> Path | None:
        direct = self.dir / f"{name}.json"
        if direct.is_file():
            return direct
        if not self.dir.is_absolute():
            candidates = [
                Path(__file__).resolve().parent.parent.parent / "data" / f"{name}.json",
                Path(__file__).resolve().parent.parent.parent.parent / "data" / f"{name}.json",
                Path.cwd() / "janrx" / "data" / f"{name}.json",
                Path.cwd() / "data" / f"{name}.json",
            ]
            for c in candidates:
                if c.is_file():
                    return c
        return None

    def status(self) -> dict[str, bool]:
        return {name: self._resolve_path(name) is not None for name in FILES}

    def load(self, name: str) -> list[dict[str, Any]]:
        if name not in self._cache:
            path = self._resolve_path(name)
            if not path:
                raise ApiError(503, "DATA_NOT_LOADED",
                               f"The {name} dataset is not available on this server. Not in our data.",
                               fallback="manual_entry")
            self._cache[name] = json.loads(path.read_text(encoding="utf-8"))
        return self._cache[name]
