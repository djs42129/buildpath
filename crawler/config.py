"""Load settings from the repo-root .env without logging the API key.

A tiny hand-rolled parser instead of python-dotenv: the file is three lines and
this keeps the crawler's dependency list short.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data"
# Sent on every Riot API request; Cloudflare rejects library default User-Agents.
USER_AGENT = "buildpath/0.1 (personal)"


@dataclass(frozen=True)
class Config:
    # repr=False keeps the key out of tracebacks and print(config).
    api_key: str = field(repr=False)
    region: str
    routing: str


def load_env(path: Path = REPO_ROOT / ".env") -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def load_config() -> Config:
    # Real environment variables win over .env, so a key can be passed in without editing the file.
    env = {**load_env(), **{k: v for k, v in os.environ.items() if k in ("RIOT_API_KEY", "REGION", "ROUTING")}}
    api_key = env.get("RIOT_API_KEY", "")
    if not api_key:
        raise SystemExit("RIOT_API_KEY is empty. Paste your key into .env at the repo root.")
    return Config(api_key=api_key, region=env.get("REGION", "na1"), routing=env.get("ROUTING", "americas"))
