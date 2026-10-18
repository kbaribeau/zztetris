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

The practice, cheese, 4w, grav, and pc modes open directly without a startup popup. Use **Game Settings** to adjust keybinds and handling settings before playing.

Settings are saved in your browser's `localStorage` for this site. **Game Settings** stores gameplay keybinds, handling, cell size, and audio level in `config`, with a separate `version` key for compatibility. These preferences stay in that browser profile; they do not sync between browsers or devices.

In normal game modes, the **gravity** checkbox saves immediately in a separate `gravity` key as `"true"` or `"false"`. Its saved value is restored when you reload or open another normal game mode on the same site. Gravity starts enabled when no preference is saved. **Reset to Defaults** in Game Settings resets its configuration but leaves gravity unchanged; use the checkbox to change it. Clearing the site's local storage removes the saved settings, including gravity. The ST lab uses temporary rules described in [ST-LAB.md](./ST-LAB.md#play).

**Game Settings → Training** groups two display-only options: **Show bag boundaries in NEXT** (default off) and **Show amber ST guide (lab only)** (default on). They save immediately as `bagBoundaries` and `stGuideVisible`, redraw open games without restarting, and persist across reloads/modes. Closing the settings popup after display-only changes does not reload the game. The guide option never adds advice to ordinary play. Reset to Defaults restores both training defaults. See [lab controls](./ST-LAB.md#play) for the advice hotkey and button.

## ST core-loop lab

Open **ST lab** from practice for finite, source-derived right-Z/T exercises: Z cap, T-spin double, pocket I and well quad. Choose a named authored board/queue and explicitly press **Start**. This is not an ongoing-game or empty-board ST solver.

Amber inset dashes show the strategy destination, including **HOLD FIRST** previews before a required swap. The normal gray drop ghost is unchanged. See [lab controls](./ST-LAB.md#play) for toggling advice and rebinding its key.

Lab SRS+/gravity-off rules are temporary and do not overwrite normal-play preferences. Unsupported/no-fit states remove advice and explain why; there is no automatic reset, dedicated retry or recovery advice. See [ST-LAB.md](./ST-LAB.md) for controls, exact scope, sources and limitations.

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
