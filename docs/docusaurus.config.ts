import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const { themes } = require("prism-react-renderer");

// The docs are deployed as a static site under /<repository>/docs/ on GitHub
// Pages. The build workflow passes the real values; the defaults make local
// builds (served from the combined site root) work without any setup.
const docsBaseUrl = process.env.DOCS_BASE_URL || "/docs/";
const siteUrl = (process.env.SITE_URL || "http://localhost:4173").replace(/\/+$/, "");
const marketingUrl = process.env.MARKETING_URL || docsBaseUrl.replace(/\/docs\/$/, "/") || "/";
const marketingHref = new URL(marketingUrl, `${siteUrl}/`).toString();

const searchOptions: Record<string, unknown> = {
  hashed: true,
  language: ["en"],
  docsRouteBasePath: "/",
  indexBlog: false,
  highlightSearchTermsOnTargetPage: true,
  searchResultLimits: 8,
  searchResultContextMaxLength: 60,
};

const presetOptions: Preset.Options = {
  docs: {
    routeBasePath: "/",
    sidebarPath: require.resolve("./sidebars.ts"),
    editUrl: "https://github.com/403access/data-cloud-compare/tree/main/docs/",
    showLastUpdateTime: false,
  },
  blog: false,
  theme: {
    customCss: require.resolve("./src/css/custom.css"),
  },
};

const themeConfig: Preset.ThemeConfig = {
  image: "img/logo.svg",
  colorMode: {
    defaultMode: "dark",
    disableSwitch: false,
    respectPrefersColorScheme: false,
  },
  navbar: {
    title: "Data Cloud Compare",
    logo: {
      alt: "Data Cloud Compare",
      src: "img/logo.svg",
    },
    items: [
      {
        type: "docSidebar",
        sidebarId: "docs",
        position: "left",
        label: "Documentation",
      },
      {
        href: marketingHref,
        label: "Website",
        position: "right",
      },
      {
        href: `${marketingHref}design-system/`,
        label: "Design",
        position: "right",
      },
      {
        href: "https://github.com/403access/data-cloud-compare",
        label: "GitHub",
        position: "right",
      },
    ],
  },
  footer: {
    links: [
      {
        title: "Product",
        items: [
          { label: "Website", href: marketingHref },
          { label: "Features", href: `${marketingHref}#features` },
          { label: "Design system", href: `${marketingHref}design-system/` },
          { label: "GitHub", href: "https://github.com/403access/data-cloud-compare" },
        ],
      },
      {
        title: "Documentation",
        items: [
          { label: "Quickstart", to: "/getting-started/quickstart" },
          { label: "Explorer guide", to: "/guides/explorer" },
          { label: "CLI reference", to: "/reference/cli" },
          { label: "Troubleshooting", to: "/help/troubleshooting" },
        ],
      },
      {
        title: "Concepts",
        items: [
          { label: "Matching model", to: "/concepts/matching" },
          { label: "Status reference", to: "/reference/statuses" },
          { label: "Reports", to: "/guides/reports" },
          { label: "Add a provider", to: "/contributing/adding-a-provider" },
        ],
      },
    ],
    copyright: `Copyright © ${new Date().getFullYear()} Data Cloud Compare. Built with Docusaurus.`,
  },
  prism: {
    theme: themes.github,
    darkTheme: themes.dracula,
    additionalLanguages: ["bash", "json", "typescript", "sql"],
  },
  tableOfContents: {
    minHeadingLevel: 2,
    maxHeadingLevel: 3,
  },
};

const config: Config = {
  title: "Data Cloud Compare",
  tagline: "Local-first verification for cloud archives",
  favicon: "img/favicon.svg",

  url: siteUrl,
  baseUrl: docsBaseUrl,
  trailingSlash: true,

  organizationName: "403access",
  projectName: "data-cloud-compare",

  onBrokenLinks: "throw",
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: "warn",
    },
  },

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  themes: [
    [
      "@easyops-cn/docusaurus-search-local",
      searchOptions,
    ],
  ],

  presets: [["classic", presetOptions]],

  themeConfig,
};

module.exports = config;
