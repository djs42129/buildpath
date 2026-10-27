"""Check whether the Riot API key in .env still works.

Development keys expire every 24 hours, so this is the first thing to run when
the crawler starts failing. Usage (from the repo root): python crawler/check_key.py
"""

from __future__ import annotations

import sys
import urllib.error
import urllib.request

from config import USER_AGENT, load_config


def main() -> int:
    config = load_config()
    # Platform status is the cheapest authenticated call: it doesn't touch match data.
    url = f"https://{config.region}.api.riotgames.com/lol/status/v4/platform-data"
    # Riot's API sits behind Cloudflare, which blocks Python's default User-Agent
    # with a 403 "error code: 1010" that looks like a bad key.
    headers = {"X-Riot-Token": config.api_key, "User-Agent": USER_AGENT}
    request = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            print(f"Key OK for {config.region} (HTTP {response.status}).")
            app_limit = response.headers.get("X-App-Rate-Limit")
            if app_limit:
                print(f"App rate limit: {app_limit}")
            return 0
    except urllib.error.HTTPError as err:
        if b"error code: 1010" in err.read():
            print("Blocked by Cloudflare (error 1010): the request's User-Agent was rejected, not the key.")
        elif err.code in (401, 403):
            print(
                f"Key rejected (HTTP {err.code}). A development key has probably expired: "
                "regenerate it on developer.riotgames.com and paste it into .env."
            )
        else:
            print(f"Unexpected HTTP {err.code} from Riot.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
