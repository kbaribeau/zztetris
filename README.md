# ZZTetris

[![Discord Shield](https://discordapp.com/api/guilds/948358018247032883/widget.png?style=shield)](https://discord.gg/Z3qDF4DVxJ)
[![Open issues](https://img.shields.io/github/issues/g3ner1c/wikimedia-cli)](https://github.com/swng/zztetris/issues)
[![Open PRs](https://img.shields.io/github/issues-pr/g3ner1c/wikimedia-cli)](https://github.com/swng/zztetris/pulls)
[![License](https://img.shields.io/github/license/swng/zztetris)](./LICENSE)
[![Repo stars](https://img.shields.io/github/stars/swng/zztetris?style=social)](https://github.com/swng/zztetris/stargazers)

**[Join the Project Discord!](https://discord.gg/Z3qDF4DVxJ)**

**[Read the Docs!](https://github.com/swng/zztetris/wiki)**

A tetris client with a name that starts with zz so you can type zz and have it autocomplete

Forked from [aznguy's schoolteto](https://github.com/aznguymp4/schoolTeto) with a number of features added

Inspired by fio's four-tris

Every app screen, including the ST lab and Game Settings, shares the same top menu: **About**, **Game Settings**, **practice**, **cheese**, **4w**, **grav**, **pc**, **ST lab**. It wraps on narrow screens; game editing controls stay separate below it. The fixed-size gameplay workspace scrolls horizontally when needed; the shared menu does not resize or rearrange gameplay controls.

The practice, cheese, 4w, grav, and pc modes open directly without a startup popup. Use **Game Settings** to adjust keybinds and handling settings before playing. Settings save immediately; in the settings popup, **Save & Close** closes the popup, and the game reloads only when legacy controls/handling changed. Mode links use ordinary browser navigation in both popup and standalone settings, including native modified-click behavior. They navigate the settings window without redirecting the opener or closing settings.

Gameplay waits for every required sprite to load successfully. A missing or failed sprite still prevents startup; there is no loading-error or retry interface.

Settings are saved in your browser's `localStorage` for this site. **Game Settings** stores gameplay keybinds, handling, cell size, and audio level in `config`, with a separate `version` key for compatibility. These preferences stay in that browser profile; they do not sync between browsers or devices.

In normal game modes, the **gravity** checkbox saves immediately in a separate `gravity` key as `"true"` or `"false"`. Its saved value is restored when you reload or open another normal game mode on the same site. Gravity starts enabled when no preference is saved. **Reset to Defaults** in Game Settings resets its configuration but leaves gravity unchanged; use the checkbox to change it. Clearing the site's local storage removes the saved settings, including gravity. The ST lab uses temporary rules described in [ST-LAB.md](./ST-LAB.md#play).

**Game Settings → Training** groups two display-only options: **Show bag boundaries in NEXT** (default off) and **Show amber ST guide (lab only)** (default on). They save immediately as `bagBoundaries` and `stGuideVisible`, redraw open games without restarting, and persist across reloads/modes. Closing the settings popup after display-only changes does not reload the game. The guide option never adds advice to ordinary play. Reset to Defaults restores both training defaults. See [lab controls](./ST-LAB.md#play) for the advice hotkey and button.

## ST free-play lab

Open **ST lab** for bounded opening and maintenance coaching for right-hand ST stacks. Empty-board advice checks partial construction using visible pieces; completing the opening is not guaranteed. The default stable-stack demonstration supports non-clearing filler → T-spin double → rebuild with fresh preview information. Amber targets have executable input witnesses; the gray outline remains the hard-drop ghost. Diagnostics distinguish checked continuations, heuristics and exhausted search budgets.

The lab uses its own zero-gravity SRS+ profile with **unlimited hold swaps**, without changing ordinary trainer modes. Full Fumen/editor tools remain in ordinary practice. See [ST-LAB.md](./ST-LAB.md) for controls, architecture, measured evidence and remaining playtest limits.

## Features (probably buggy lol)

- Fumen import/export
- Image import works through clipboard
- Undo/redo with board history
- Optional bag boundaries (enable in **Game Settings → Training**): a 2px corner on the last NEXT piece before each explicit queue-segment boundary; a top-edge cue when that piece is already active. Custom and special-mode segments can have different lengths, and queues without separators have no inferred boundary.
- *Full* fumen import/export sets your board state history as the fumen pages and vice versa.
- Drawing garbage on the board

## Regression tests

With the Node version in `.nvmrc`, run `npm ci && npm test`. The suite exercises the real pages and gameplay without launching a browser. See [TESTING.md](./TESTING.md) for setup, behavioral coverage, retained results, and browser-only limits.

## TODO

- fix DAS stuff more?
- add alternate kick tables
