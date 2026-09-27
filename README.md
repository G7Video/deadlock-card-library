# Deadlock Card Studio Library

Verified normal-mode wiki item cards for Deadlock Card Studio. Enhanced and Street Brawl-only variants are excluded.

## Current status

The initial 156-card baseline is being deployed. Cloud refresh is configured daily, but the first live refresh is blocked by the wiki’s Cloudflare verification on GitHub-hosted runners. Do not treat the baseline as a fresh automated wiki refresh. Failed refreshes never replace released media.

The manual baseline workflow verifies every image before deployment. The daily publisher discovers new items, renders their default wiki tables, verifies output, and preserves old SHA-256 image paths. It requires permitted unattended wiki access before it can run successfully. No challenge bypass is implemented.

The Premiere plugin includes its own baseline and downloads verified updates directly; plugin users need no helper, Node, Python, separate card pack, or GitHub account. Animation remains editable in Premiere.

Wiki text: Deadlock Wiki contributors, CC BY-NC-SA 4.0 (https://deadlock.wiki/). Game artwork belongs to its respective owners. Code license does not grant rights to wiki or game assets. Unofficial; not affiliated with Valve or Adobe.
