# Jottacloud Archive vs local index — summary

Local reference: `file_indexer.db` (indexed 2026-08-25), paths rooted at `/mnt/tank` (prefix stripped).  
Remote: Jottacloud `Archive` mountpoint, listed 2026-11-09.

## Headline

- Archive: **1,434,971 files**, **196,836 folders**, 7,142.4 GB
- Present locally at the same path: **1,173,034 files**
- Present but moved (same name + size found elsewhere in DB): **23,384 files**, 29.4 GB
- Possible (same name, different size — needs review): **61,582 files**, 16.7 GB
- **Missing (not found anywhere in DB): 176,971 files / 12,303 folders, 96.0 GB**
- Overall file coverage: **87.67%**
- Local-only DB entries (in DB, not in Archive): **5,077 files**, 42.4 GB

## Missing by top-level folder (files only)

| Top-level | Missing files | Possible files | Missing size |
|---|---:|---:|---:|
| `GoogleDrivePrivate` | 71,818 | 22,532 | 8.8 GB |
| `Projects` | 47,563 | 17,388 | 0.6 GB |
| `Synology` | 15,335 | 5,152 | 0.1 GB |
| `Backup.16.10.2020` | 14,511 | 6,072 | 0.1 GB |
| `_windows_backup_28-05-2025` | 13,225 | 4,684 | 0.7 GB |
| `Bonuz` | 9,109 | 3,955 | 1.6 GB |
| `2026-07-17` | 3,385 | 110 | 67.6 GB |
| `_macos_2025-05-26` | 1,161 | 311 | 16.4 GB |
| `Programme` | 706 | 1,179 | 0.0 GB |
| `GoogleDrive-Backup-2025-05-29` | 132 | 199 | 0.0 GB |
| `Backup-C` | 11 | 0 | 0.0 GB |
| `SynologyNew` | 6 | 0 | 0.0 GB |
| `_temp_games` | 5 | 0 | 0.0 GB |
| `[redacted invoice].PDF` | 1 | 0 | 0.0 GB |
| `Backup_2022-05-30_anyu-20230530T193251Z-001.zip` | 1 | 0 | 0.0 GB |
| `FRITZ!Box 7590 - WLAN.pdf` | 1 | 0 | 0.0 GB |
| `__becker` | 1 | 0 | 0.1 GB |

## Largest missing folders by file count

| Archive folder | Missing files | Missing size |
|---|---:|---:|
| `Projects/Dark/Software/Shop/calibaba.client/node_modules/@fortawesome/free-solid-svg-icons` | 1,931 | 0.0 GB |
| `Projects/doqmend.project/web/web.client/node_modules/@fortawesome/free-solid-svg-icons` | 1,931 | 0.0 GB |
| `Projects/Nutrition/Client/node_modules/@fortawesome/free-solid-svg-icons` | 1,931 | 0.0 GB |
| `Synology/Backup.16.10.2020/doqmend.project/web/web.client/node_modules/@fortawesome/free-solid-svg-icons` | 1,931 | 0.0 GB |
| `Projects/Programming/doqmend.project/web/web.client/node_modules/@fortawesome/free-solid-svg-icons` | 1,931 | 0.0 GB |
| `_windows_backup_28-05-2025/Backup/Backup.16.10.2020/Dark/Software/Shop/calibaba.client/node_modules/@fortawesome/free-solid-svg-icons` | 1,931 | 0.0 GB |
| `Synology/Backup.16.10.2020/Dark/Software/Shop/calibaba.client/node_modules/@fortawesome/free-solid-svg-icons` | 1,930 | 0.0 GB |
| `2026-07-17/Kraken_OHLCVT_Q2_2025` | 1,570 | 0.3 GB |
| `GoogleDrivePrivate/nextcloud/_Mac/Desktop/Projects/solana/solana/target/debug/deps` | 1,128 | 1.5 GB |
| `Projects/Nutrition/Client/node_modules/@fortawesome/free-brands-svg-icons` | 887 | 0.0 GB |
| `Projects/Dark/Software/Shop/calibaba.client/node_modules/@fortawesome/free-brands-svg-icons` | 879 | 0.0 GB |
| `Projects/doqmend.project/web/web.client/node_modules/@fortawesome/free-brands-svg-icons` | 879 | 0.0 GB |
| `Synology/Backup.16.10.2020/Dark/Software/Shop/calibaba.client/node_modules/@fortawesome/free-brands-svg-icons` | 879 | 0.0 GB |
| `Synology/Backup.16.10.2020/doqmend.project/web/web.client/node_modules/@fortawesome/free-brands-svg-icons` | 879 | 0.0 GB |
| `Projects/Programming/doqmend.project/web/web.client/node_modules/@fortawesome/free-brands-svg-icons` | 879 | 0.0 GB |
| `_windows_backup_28-05-2025/Backup/Backup.16.10.2020/Dark/Software/Shop/calibaba.client/node_modules/@fortawesome/free-brands-svg-icons` | 879 | 0.0 GB |
| `2026-07-17` | 792 | 65.6 GB |
| `GoogleDrivePrivate/nextcloud/_Mac/Desktop/Projects/solana/solana/docs/node_modules/pretty-error/node_modules/lodash` | 636 | 0.0 GB |
| `Backup.16.10.2020/zuordnen/_Projekte/reactjs_tutorial/node_modules/lodash` | 616 | 0.0 GB |
| `Projects/Dark/Software/Shop/calibaba.client/node_modules/lodash` | 616 | 0.0 GB |

## Largest missing folders by size

| Archive folder | Missing files | Missing size |
|---|---:|---:|
| `2026-07-17` | 792 | 65.6 GB |
| `_macos_2025-05-26` | 79 | 16.3 GB |
| `GoogleDrivePrivate/nextcloud/_Mac/Desktop/Projects/solana/solana/target/debug/deps` | 1,128 | 1.5 GB |
| `2026-07-17/_Desktop2` | 199 | 0.5 GB |
| `Bonuz/Work-Repositories/bonuz-land-nextjs-ts/.next/cache/webpack/client-development` | 7 | 0.5 GB |
| `GoogleDrivePrivate/nextcloud/_Mac/Desktop/Projects/savegame/savegame/target/debug/deps` | 274 | 0.3 GB |
| `GoogleDrivePrivate/nextcloud/_Mac/Desktop/Projects/savegame/savegame/target/rls/debug/deps` | 279 | 0.3 GB |
| `GoogleDrivePrivate/nextcloud/_Mac/Desktop/Projects/serum/anchor/examples/tutorial/basic-2/target/rls/debug/deps` | 269 | 0.3 GB |
| `GoogleDrivePrivate/nextcloud/_Mac/Desktop/Projects/serum/anchor/examples/tutorial/basic-1/target/rls/debug/deps` | 269 | 0.3 GB |
| `GoogleDrivePrivate/nextcloud/_Mac/Desktop/Projects/savegame/savegame/programs/savegame/target/rls/debug/deps` | 269 | 0.3 GB |
| `GoogleDrivePrivate/nextcloud/_Mac/Desktop/Projects/savegame/savegame-dapp/target/rls/debug/deps` | 269 | 0.3 GB |
| `GoogleDrivePrivate/nextcloud/_Mac/Desktop/Projects/serum/meme-num/target/rls/debug/deps` | 269 | 0.3 GB |
| `2026-07-17/Kraken_OHLCVT_Q2_2025` | 1,570 | 0.3 GB |
| `GoogleDrivePrivate/nextcloud/_Mac/Desktop/Projects/serum/anchor/examples/tutorial/basic-1/target/release/deps` | 144 | 0.2 GB |
| `GoogleDrivePrivate/nextcloud/_Mac/Desktop/Projects/serum/anchor/examples/tutorial/basic-0/target/release/deps` | 144 | 0.2 GB |
| `GoogleDrivePrivate/nextcloud/_Mac/Desktop/Projects/savegame/savegame-dapp/target/release/deps` | 144 | 0.2 GB |
| `GoogleDrivePrivate/nextcloud/_Mac/Desktop/Projects/savegame/savegame/target/release/deps` | 144 | 0.2 GB |
| `GoogleDrivePrivate/nextcloud/_Mac/Desktop/Projects/serum/meme-num/target/release/deps` | 144 | 0.2 GB |
| `2026-07-17/Aufnahmeanträge` | 121 | 0.2 GB |
| `Bonuz/web3auth_experiments/web3auth_nextjs/.next/cache/webpack/client-development` | 4 | 0.2 GB |

## Largest missing individual files

| Archive file | Size |
|---|---:|
| `2026-07-17/4541099D.zip` | 14.3 GB |
| `2026-07-17/Dokumente (1).zip` | 11.1 GB |
| `_macos_2025-05-26/Backup.16.10.2020.zip` | 7.8 GB |
| `2026-07-17/4541093E.zip` | 6.1 GB |
| `2026-07-17/454108D8.zip` | 5.7 GB |
| `2026-07-17/454108C0.zip` | 5.3 GB |
| `2026-07-17/4541084C.zip` | 5.3 GB |
| `2026-07-17/de_companies_ocdata.jsonl` | 4.1 GB |
| `_macos_2025-05-26/464F0803.zip` | 3.7 GB |
| `2026-07-17/464F0803.zip` | 3.7 GB |
| `_macos_2025-05-26/_Projekte_Nicht_Zugeordnet.zip` | 3.4 GB |
| `2026-07-17/3dff93d69e712f34eecdd250fa13d4a37a220819597c5f4aeb1965e19179b505-2025-12-25-18-35-17-1004354d479848c7bee34056f96dac30.zip` | 1.0 GB |
| `2026-07-17/420cloud_new.zip` | 0.9 GB |
| `2026-07-17/[redacted chat export].zip` | 0.8 GB |
| `2026-07-17/Dirk Gentlys Holistische Detektei Staffel 2 Folge 2 HD Deutsch.mp4` | 0.7 GB |
| `_macos_2025-05-26/3DModels.zip` | 0.7 GB |
| `2026-07-17/Kraken_OHLCVT_Q2_2025.zip` | 0.5 GB |
| `_macos_2025-05-26/Auto_Tune_Central_1.5.1_universal.dmg` | 0.4 GB |
| `2026-07-17/420cloud_new copy.zip` | 0.4 GB |
| `2026-07-17/Atomic.Chat_1.1.119_universal.dmg` | 0.4 GB |

## Local-only (in DB, not found in Archive)

| Top-level | Files | Size |
|---|---:|---:|
| `Projects` | 3,230 | 7.3 GB |
| `_LikedSongs` | 1,466 | 7.7 GB |
| `xXx` | 367 | 16.6 GB |
| `Kontakte` | 10 | 3.2 GB |
| `Dokumente` | 2 | 0.0 GB |
| `Programme` | 2 | 7.7 GB |

## How to read the report

- `report/report.html` — self-contained visual diff. Green = present at same path; blue = present but moved; amber = possible/partial; red = missing. The tree opens filtered to problem folders; uncheck “only folders with missing items” to see everything.
- `report/missing.csv` — every missing Archive item (path, type, status, size).
- `report/moved.csv` — every moved/possible/partial item, including the DB path where it was found.
- `report/local_only.csv` — DB items with no Archive counterpart.
- `report/report_data.json` — full machine-readable dataset.

Matching is name + size for moved files. Jottacloud exposes MD5 while the DB stores SHA-256, so a direct hash cross-check was not possible. Treat `possible` as “needs a look”, not confirmed missing. The DB is the reference; live `/mnt/tank` was not used.
## What “missing” actually means here

An Archive file is labelled **missing** only when, after stripping `/mnt/tank/`:

1. no DB file exists at the same relative path (case-insensitive fallback included), **and**
2. no DB file exists *anywhere* with the same basename **and** the same byte size.

Folder status is aggregated from its children: a folder is `missing` only when neither the folder path/name nor any child was found; folders with some children found are `partial`, not missing.

This is therefore **absence from the `file_indexer.db` snapshot (2026-08-25)**, not proof that a file was deleted or is absent from the live disk. The live `/mnt/tank` was intentionally not consulted.

### Important caveat: the indexer skips dependency/build folders

The DB's `ignore_folders` setting covers `node_modules`, `.next`, `dist`, `build`, `target`, `.gradle`, `vendor`, `__pycache__`, `.venv`, `.turbo`, `bin`, `obj`, `__history`, `__recovery` (some conditionally, via marker files).

- **173,463 of 176,971 missing files (98.0%, 11.9 GB)** are under one of those folder names — mostly `node_modules` (118,028), `vendor` (34,517), `target` (17,483), `dist` (6,211), `build` (3,224), `.next` (3,003).
- These are expected to be absent from the index because the indexer deliberately skipped them.
- The **actionable remainder is 3,508 files / 84.1 GB** outside those folders, dominated by:
  - `2026-07-17` — 3,385 files, 67.6 GB
  - `_macos_2025-05-26` — 96 files, 16.4 GB

“Missing” is not a content comparison: Jottacloud exposes MD5 while the DB stores SHA-256, so a file renamed *and* resized could be reported missing even if a copy exists. Same-name/different-size files are reported as `possible`, not missing.
