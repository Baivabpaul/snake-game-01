import json
import os
from pathlib import Path


class HighScoreManager:
    """Manages reading and persisting the snake game high score."""

    def __init__(self, filename: str = "highscore.json"):
        self.file_path = Path(__file__).resolve().parent.parent.parent.parent / filename
        self._cached_high_score = self._load()

    def _load(self) -> int:
        try:
            if self.file_path.exists():
                with open(self.file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return int(data.get("high_score", 0))
        except Exception:
            pass
        return 0

    @property
    def high_score(self) -> int:
        return self._cached_high_score

    def update(self, score: int) -> bool:
        """Update high score if the new score is higher. Returns True if a new record was set."""
        if score > self._cached_high_score:
            self._cached_high_score = score
            self._save()
            return True
        return False

    def _save(self):
        try:
            with open(self.file_path, "w", encoding="utf-8") as f:
                json.dump({"high_score": self._cached_high_score}, f, indent=2)
        except Exception:
            pass
