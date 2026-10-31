# UI Integration Handoff for Development Agents

This is an **asset + specification package**, not a complete Cocos Creator project.
Do not overwrite the existing project's root `AGENT.md` or use images as a substitute for real UI functionality.

## Step-by-step implementation

1. Read `README_CN.md`, `Docs/DEV_AGENT_TASKS.md`, and the existing game's root `AGENT.md`.
2. Read `Config/screen_registry.json` for 33 UI IDs, route identifiers, states and actions.
3. Inspect `DesignReference/FullScreenPNG/` only as visual references and `DesignSource/FullScreenSVG/` for layout details.
4. Merge `CocosDropIn/assets/resources/ui/` into the existing Cocos Creator project (see `Tools/install_cocos_assets.py`; dry-run is default).
5. Build prefabs/scenes using Cocos Label, EditBox, Button, Layout, ScrollView, Canvas and SafeArea. Implement four bottom tabs only.
6. Bind every UI intent to the project's actual domain-query or domain-command service; do not implement monetary operations in the view layer.
7. Finish stages D0 -> D5 as listed in `Docs/DEV_AGENT_TASKS.md`, recording screenshots and failed cases.
8. Validate TapTap-compatible build, user input, storage, touch targets, restart, onboarding, offline simulation, and close-company behavior before marking UI implemented.

## Non-negotiable rules

- Dynamic text and amounts are NEVER taken from full-screen PNGs.
- Hiring, layoff, department creation, rescue and company reset require validated, idempotent game commands.
- The archived 5th `Settings` nav icon is not a 5th tab; Settings is opened from Company dashboard.
- No `.prefab`, `.scene`, `.meta`, nine-slice metadata or working TypeScript implementation is contained in this handoff.
- Source images are reusable production candidates; component construction, device QA and legal/licensing review are still required.
