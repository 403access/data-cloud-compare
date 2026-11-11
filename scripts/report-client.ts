/**
 * Client-side interactions for the generated comparison report.
 *
 * This file is compiled to JavaScript at report generation time and inlined
 * into the self-contained report.html. DATA, LABELS and N_ISSUES are injected
 * by the surrounding document.
 */

interface Bucket {
  files: number;
  dirs: number;
  bytes: number;
}

interface Summary {
  archive: Bucket;
  buckets: Record<string, Bucket>;
  present_files: number;
  missing_files: number;
  present_pct: number;
  db_entries: number;
  local_only_count?: number;
}

interface TopFolder {
  name: string;
  files: number;
  dirs: number;
  exact: number;
  moved: number;
  possible: number;
  missing: number;
  bytes: number;
}

interface FolderRecord {
  p: string;
  s: string;
  n: number;
  e: number;
  m: number;
  x: number;
  f?: string;
}

interface Issue {
  p: string;
  d: number;
  s: string;
  z: number;
  f?: string;
  n?: string;
}

interface ReportData {
  summary: Summary;
  top: TopFolder[];
  folders: FolderRecord[];
  issues: Issue[];
  issue_counts: Record<string, number>;
  status_labels: Record<string, string>;
  samples: Record<string, number>;
}

declare const DATA: ReportData;
declare const LABELS: Record<string, string>;
declare const N_ISSUES: number;

const byId = <T extends HTMLElement>(id: string): T =>
  document.getElementById(id) as T;

const COLORS: Record<string, string> = {
  present_exact: "var(--green)",
  present_moved: "var(--blue)",
  partial: "var(--amber)",
  possible: "var(--amber)",
  missing: "var(--red)",
};

const fmt = (n: number): string => n.toLocaleString();

function human(n: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = n;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${index ? value.toFixed(1) : value} ${units[index]}`;
}

const S = DATA.summary;

const cards: Array<[string, string, string, string]> = [
  ["Archive files", fmt(S.archive.files), human(S.archive.bytes), ""],
  ["Archive folders", fmt(S.archive.dirs), "", ""],
  ["Present (same path)", fmt(S.buckets.exact.files), "files", "g"],
  ["Present (moved)", fmt(S.buckets.moved.files), "files", "b"],
  ["Possible", fmt(S.buckets.possible.files), "files", "a"],
  ["Missing", fmt(S.buckets.missing.files), "files", "r"],
  [
    "Coverage",
    `${S.present_pct.toFixed(2)}%`,
    "of archive files found",
    S.present_pct > 99 ? "g" : S.present_pct > 90 ? "b" : "a",
  ],
  [
    "Local-only DB entries",
    fmt(S.local_only_count || 0),
    "in DB, not in Archive",
    "",
  ],
];
byId("cards").innerHTML = cards
  .map(
    ([key, value, detail, tone]) =>
      `<div class="card ${tone}"><div class="k">${key}</div><div class="v">${value}</div><div class="d">${detail}</div></div>`,
  )
  .join("");

const total = Math.max(1, S.archive.files);
const segments: Array<[string, string]> = [
  ["exact", "var(--green)"],
  ["moved", "var(--blue)"],
  ["possible", "var(--amber)"],
  ["missing", "var(--red)"],
];
byId("bar").innerHTML = segments
  .map(
    ([key, color]) =>
      `<span style="width:${(100 * S.buckets[key].files) / total}%;background:${color}"></span>`,
  )
  .join("");
byId("legend").innerHTML = segments
  .map(
    ([key, color]) =>
      `<span><span class="dot" style="background:${color}"></span>${key}: ${fmt(S.buckets[key].files)} files</span>`,
  )
  .join("");

const topTable = document.querySelector<HTMLTableSectionElement>("#toptable tbody")!;
topTable.innerHTML = DATA.top
  .map(
    (row) => `<tr>
  <td class="mono">${row.name}</td><td class="num">${fmt(row.files)}</td><td class="num">${fmt(row.dirs)}</td>
  <td class="num">${fmt(row.exact)}</td><td class="num">${fmt(row.moved)}</td>
  <td class="num">${fmt(row.possible)}</td><td class="num">${fmt(row.missing)}</td>
  <td class="num">${human(row.bytes)}</td></tr>`,
  )
  .join("");

const topFilter = byId<HTMLSelectElement>("topfilter");
DATA.top.forEach((row) => {
  const option = document.createElement("option");
  option.value = row.name;
  option.textContent = row.name;
  topFilter.appendChild(option);
});

type Predicate = (issue: Issue) => boolean;
const tabsDef: Array<[string, string, Predicate]> = [
  ["all", "All differences", () => true],
  ["present_moved", "Moved", (issue) => issue.s === "present_moved"],
  ["possible", "Possible", (issue) => issue.s === "possible" || issue.s === "partial"],
  ["size_mismatch", "Size differs", (issue) => issue.s === "size_mismatch"],
  ["missing", "Missing", (issue) => issue.s === "missing"],
];
const COUNTS = DATA.issue_counts || {};

function tabCount(key: string): number {
  if (key === "all") {
    return Object.values(COUNTS).reduce((sum, value) => sum + value, 0);
  }
  if (key === "possible") {
    return (COUNTS.possible || 0) + (COUNTS.partial || 0);
  }
  return COUNTS[key] || 0;
}

let active = "all";
byId("tabs").innerHTML = tabsDef
  .map(
    ([key, label]) =>
      `<div class="tab${key === "all" ? " active" : ""}" data-k="${key}">${label} (${tabCount(key).toLocaleString()})</div>`,
  )
  .join("");
byId("samplenote").textContent = `The table below shows a bounded sample (${DATA.issues.length.toLocaleString()} rows) to keep this page light. The complete lists are in missing.csv / moved.csv and report_data.json.`;

const query = byId<HTMLInputElement>("q");
const shown = byId("shown");
const issueBody = document.querySelector<HTMLTableSectionElement>("#issuetable tbody")!;

function renderIssues(): void {
  const needle = query.value.toLowerCase();
  const top = topFilter.value;
  const predicate = tabsDef.find(([key]) => key === active)![2];
  const rows: Issue[] = [];
  for (const issue of DATA.issues) {
    if (!predicate(issue)) continue;
    if (top && !issue.p.startsWith(`${top}/`)) continue;
    if (
      needle &&
      !(
        issue.p.toLowerCase().includes(needle) ||
        issue.s.includes(needle) ||
        (issue.f || "").toLowerCase().includes(needle) ||
        (issue.n || "").toLowerCase().includes(needle)
      )
    ) {
      continue;
    }
    rows.push(issue);
    if (rows.length >= 5000) break;
  }
  issueBody.innerHTML = rows
    .map(
      (issue) => `<tr>
    <td><span class="badge s-${issue.s}">${LABELS[issue.s] || issue.s}</span></td>
    <td class="mono">${issue.d ? "📁 " : ""}${issue.p}</td>
    <td class="num">${issue.d ? "" : fmt(issue.z)}</td>
    <td class="mono muted">${issue.f ? `↳ ${issue.f}` : ""}${issue.n ? (issue.f ? "<br>" : "") + issue.n : ""}</td></tr>`,
    )
    .join("");
  shown.textContent = `showing ${fmt(rows.length)} sample row(s)${
    rows.length >= 5000
      ? " (table capped at 5,000 — use the CSV/report_data.json for everything)"
      : ""
  }`;
}

byId("tabs").addEventListener("click", (event) => {
  const tab = (event.target as Element | null)?.closest<HTMLElement>(".tab");
  if (!tab) return;
  active = tab.dataset.k || "all";
  document.querySelectorAll<HTMLElement>(".tab").forEach((element) => {
    element.classList.toggle("active", element === tab);
  });
  renderIssues();
});
query.addEventListener("input", renderIssues);
topFilter.addEventListener("change", renderIssues);
byId("issuecount").textContent = `(${fmt(N_ISSUES)} items)`;
renderIssues();

const byParent: Record<string, FolderRecord[]> = {};
DATA.folders.forEach((folder) => {
  const parent = folder.p.includes("/") ? folder.p.slice(0, folder.p.lastIndexOf("/")) : "";
  (byParent[parent] = byParent[parent] || []).push(folder);
});

const folderSearch = byId<HTMLInputElement>("foldersearch");
const onlyProblems = byId<HTMLInputElement>("onlyproblems");

function statusColor(status: string): string {
  return COLORS[status] || "var(--muted)";
}

function hasProblem(folder: FolderRecord): boolean {
  if (folder.x > 0 || folder.s === "missing" || folder.s === "partial") return true;
  return (byParent[folder.p] || []).some(hasProblem);
}

function node(folder: FolderRecord): string {
  const kids = byParent[folder.p] || [];
  if (onlyProblems.checked && folder.x === 0 && !kids.some(hasProblem)) return "";
  const needle = folderSearch.value.toLowerCase();
  if (
    needle &&
    !folder.p.toLowerCase().includes(needle) &&
    !kids.some((kid) => kid.p.toLowerCase().includes(needle))
  ) {
    return "";
  }
  const color = statusColor(folder.s);
  const badge = `<span class="pill" style="background:${color}22;color:${color}">${LABELS[folder.s] || folder.s}</span>`;
  const counts = `<span class="muted">${fmt(folder.n)} items · ${fmt(folder.e)} exact · ${fmt(folder.m)} moved · ${fmt(folder.x)} missing</span>`;
  if (kids.length) {
    return `<details><summary>📁 <b>${folder.p.split("/").pop()}</b> ${badge} ${counts}</summary>${kids.map(node).join("")}</details>`;
  }
  return `<div class="leaf">📁 ${folder.p.split("/").pop()} ${badge} ${counts}</div>`;
}

function renderTree(): void {
  const roots = byParent[""] || [];
  byId("tree").innerHTML =
    roots.map(node).join("") ||
    '<div class="muted" style="padding:10px">No folders match.</div>';
}

folderSearch.addEventListener("input", renderTree);
onlyProblems.addEventListener("change", renderTree);
renderTree();
