# Deadlock Card Studio Library

Verified normal-mode wiki item cards for Deadlock Card Studio. Enhanced and Street Brawl-only variants are excluded.

## Current status

The verified 156-card baseline is live at https://g7video.github.io/deadlock-card-library/. Native Premiere 0.4.25 successfully checked the hosted manifest and verified all cards without a helper prompt. Cloud refresh is configured daily, but the first live refresh is blocked by the wiki’s Cloudflare verification on GitHub-hosted runners. Do not treat the baseline as a fresh automated wiki refresh. Failed refreshes never replace released media.

The manual baseline workflow verified every image before deployment (successful run 36351695340). The daily publisher discovers new items, renders their default wiki tables, verifies output, and preserves old SHA-256 image paths. It requires permitted unattended wiki access before it can run successfully. No challenge bypass is implemented.

The Premiere plugin includes its own baseline and downloads verified updates directly; plugin users need no helper, Node, Python, separate card pack, or GitHub account. Animation remains editable in Premiere.

Wiki text: Deadlock Wiki contributors, CC BY-NC-SA 4.0 (https://deadlock.wiki/). Game artwork belongs to its respective owners. Code license does not grant rights to wiki or game assets. Unofficial; not affiliated with Valve or Adobe.

