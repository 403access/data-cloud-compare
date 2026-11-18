/* Aether OS — explorer fixture data
   A small two-sided snapshot that stands in for file_indexer.db and archive.json. */

import { gb, mb, kb } from "./utils.js";

/* ------------------------------------------------------------- data */

export const DATA = {
  local: [
    { name: "_LikedSongs", isDir: true, status: "local_only", folderSize: "7.13 GB", sizeValue: gb(7.13), childCount: 5, modified: "2025-06-18", path: "/mnt/tank/_LikedSongs", note: "Local folder with no archive counterpart." },
    { name: "_macos_2025-05-26", isDir: true, status: "partial", folderSize: "88.0 GB", sizeValue: gb(88), childCount: 4, modified: "2026-01-04", path: "/mnt/tank/_macos_2025-05-26", note: "Some children are missing from the archive." },
    { name: "_order_me", isDir: true, status: "exact", folderSize: "91.0 GB", sizeValue: gb(91), childCount: 613, modified: "2025-06-18", path: "/mnt/tank/_order_me" },
    { name: "_Sounds_Videos_Unsorted", isDir: true, status: "exact", folderSize: "18.1 MB", sizeValue: mb(18.1), childCount: 73, modified: "2025-06-19", path: "/mnt/tank/_Sounds_Videos_Unsorted" },
    { name: "_windows_backup_28-05-2025", isDir: true, status: "exact", folderSize: "658 GB", sizeValue: gb(658), childCount: 14, modified: "2025-06-19", path: "/mnt/tank/_windows_backup_28-05-2025" },
    { name: "Audio", isDir: true, status: "exact", folderSize: "1.28 MB", sizeValue: mb(1.28), childCount: 4, modified: "2025-06-19", path: "/mnt/tank/Audio" },
    { name: "Authenticator - Google", isDir: true, status: "exact", folderSize: "1.76 MB", sizeValue: mb(1.76), childCount: 2, modified: "2025-06-19", path: "/mnt/tank/Authenticator - Google" },
    { name: "Backup-C", isDir: true, status: "exact", folderSize: "155 GB", sizeValue: gb(155), childCount: 36, modified: "2025-06-19", path: "/mnt/tank/Backup-C" },
    { name: "Backup.16.10.2020", isDir: true, status: "exact", folderSize: "4.23 GB", sizeValue: gb(4.23), childCount: 12, modified: "2025-06-24", path: "/mnt/tank/Backup.16.10.2020" },
    { name: "Benedikt Pilz", isDir: true, status: "exact", folderSize: "21.5 MB", sizeValue: mb(21.5), childCount: 8, modified: "2025-06-19", path: "/mnt/tank/Benedikt Pilz" },
    { name: "Bewerbung", isDir: true, status: "exact", folderSize: "8.24 MB", sizeValue: mb(8.24), childCount: 22, modified: "2025-06-19", path: "/mnt/tank/Bewerbung" },
    { name: "Bilder_Videos", isDir: true, status: "exact", folderSize: "62.8 GB", sizeValue: gb(62.8), childCount: 112, modified: "2025-06-19", path: "/mnt/tank/Bilder_Videos" },
    { name: "Bonuz", isDir: true, status: "exact", folderSize: "22.7 GB", sizeValue: gb(22.7), childCount: 7, modified: "2025-06-27", path: "/mnt/tank/Bonuz" },
    { name: "CHANGELOG.md", type: "MD", size: "6.7 KB", sizeValue: kb(6.7), status: "exact", modified: "2025-06-19", path: "/mnt/tank/CHANGELOG.md" },
    { name: "notes.md", type: "MD", size: "3.2 KB", sizeValue: kb(3.2), status: "local_only", modified: "2026-11-12", path: "/mnt/tank/Projects/Aurora/notes.md", note: "Kept locally; no archive counterpart." },
    { name: "package.json", type: "JSON", size: "2.1 KB", sizeValue: kb(2.1), status: "exact", modified: "2026-11-11", path: "/mnt/tank/package.json" },
    { name: "README.md", type: "MD", size: "11.4 KB", sizeValue: kb(11.4), status: "moved_match", modified: "2026-11-12", path: "/mnt/tank/Projects/Aurora/README.md", foundAt: "/Archive/Projects/Aurora/README.md", note: "Same size and content hash, found at a different archive path." },
    { name: ".env.local", type: "ENV", size: "412 B", sizeValue: 412, status: "local_only", modified: "2026-11-09", path: "/mnt/tank/.env.local", note: "Dotfile. Enable Hidden to show it by default." },
    { name: ".DS_Store", type: "FILE", size: "8 KB", sizeValue: kb(8), status: "unmatched", modified: "2025-06-20", path: "/mnt/tank/.DS_Store" },
  ],
  remote: [
    { name: "2026-07-17", isDir: true, status: "partial", folderSize: "74.5 GB", sizeValue: gb(74.5), childCount: 5, modified: "2025-06-19", path: "/Archive/2026-07-17", note: "Some children are missing from the local index." },
    { name: "__becker", isDir: true, status: "missing", folderSize: "81.9 MB", sizeValue: mb(81.9), childCount: 9, modified: "2025-06-19", path: "/Archive/__becker" },
    { name: "_macos_2025-05-26", isDir: true, status: "partial", folderSize: "130 GB", sizeValue: gb(130), childCount: 4, modified: "2025-06-19", path: "/Archive/_macos_2025-05-26" },
    { name: "_macos_2025-06-25", isDir: true, status: "missing", folderSize: "0 B", sizeValue: 0, childCount: 0, modified: "2025-06-25", path: "/Archive/_macos_2025-06-25" },
    { name: "_order_me", isDir: true, status: "exact", folderSize: "91.0 GB", sizeValue: gb(91), childCount: 613, modified: "2025-06-19", path: "/Archive/_order_me" },
    { name: "_Sounds_Videos_Unsorted", isDir: true, status: "exact", folderSize: "18.1 MB", sizeValue: mb(18.1), childCount: 73, modified: "2025-06-19", path: "/Archive/_Sounds_Videos_Unsorted" },
    { name: "_temp_games", isDir: true, status: "missing", folderSize: "11.2 MB", sizeValue: mb(11.2), childCount: 3, modified: "2025-06-19", path: "/Archive/_temp_games" },
    { name: "_windows_backup_28-05-2025", isDir: true, status: "exact", folderSize: "659 GB", sizeValue: gb(659), childCount: 14, modified: "2025-06-19", path: "/Archive/_windows_backup_28-05-2025" },
    { name: "Audio", isDir: true, status: "exact", folderSize: "1.28 MB", sizeValue: mb(1.28), childCount: 4, modified: "2025-06-19", path: "/Archive/Audio" },
    { name: "Authenticator - Google", isDir: true, status: "exact", folderSize: "1.76 MB", sizeValue: mb(1.76), childCount: 2, modified: "2025-06-19", path: "/Archive/Authenticator - Google" },
    { name: "Backup-C", isDir: true, status: "exact", folderSize: "155 GB", sizeValue: gb(155), childCount: 36, modified: "2025-06-19", path: "/Archive/Backup-C" },
    { name: "Backup.16.10.2020", isDir: true, status: "exact", folderSize: "4.35 GB", sizeValue: gb(4.35), childCount: 12, modified: "2025-06-19", path: "/Archive/Backup.16.10.2020" },
    { name: "Benedikt Pilz", isDir: true, status: "exact", folderSize: "21.5 MB", sizeValue: mb(21.5), childCount: 8, modified: "2025-06-19", path: "/Archive/Benedikt Pilz" },
    { name: "Bewerbung", isDir: true, status: "exact", folderSize: "8.24 MB", sizeValue: mb(8.24), childCount: 22, modified: "2025-06-19", path: "/Archive/Bewerbung" },
    { name: "Bilder_Videos", isDir: true, status: "exact", folderSize: "62.8 GB", sizeValue: gb(62.8), childCount: 112, modified: "2025-06-19", path: "/Archive/Bilder_Videos" },
    { name: "Bonuz", isDir: true, status: "exact", folderSize: "26.7 GB", sizeValue: gb(26.7), childCount: 7, modified: "2025-06-27", path: "/Archive/Bonuz" },
    { name: "CHANGELOG.md", type: "MD", size: "6.7 KB", sizeValue: kb(6.7), status: "exact", modified: "2025-06-19", path: "/Archive/CHANGELOG.md" },
    { name: "package.json", type: "JSON", size: "2.1 KB", sizeValue: kb(2.1), status: "exact", modified: "2025-06-19", path: "/Archive/package.json" },
    { name: "README.md", type: "MD", size: "11.4 KB", sizeValue: kb(11.4), status: "moved", modified: "2026-11-12", path: "/Archive/Projects/Aurora/README.md", foundAt: "/mnt/tank/Projects/Aurora/README.md", note: "Moved from the local path; same name and size." },
    { name: ".cache", isDir: true, status: "missing", folderSize: "412 MB", sizeValue: mb(412), childCount: 12, modified: "2025-06-21", path: "/Archive/.cache" },
    { name: ".DS_Store", type: "FILE", size: "8 KB", sizeValue: kb(8), status: "missing", modified: "2025-06-20", path: "/Archive/.DS_Store" },
  ],
};

export const SUMMARY = {
  local: { items: 19, dirs: 13, files: 6, size: "6.41 TB" },
  remote: { items: 21, dirs: 17, files: 4, size: "6.50 TB" },
};
