// Metro config for the Expo app inside the agentplain monorepo.
//
// The app is otherwise self-contained (its own node_modules under apps/mobile),
// but it imports ONE shared, dependency-free module from the repo root:
// lib/mobile/api-client.ts, aliased to `@shared/lib/mobile/api-client`. We
// teach Metro to (a) watch the shared lib/ folder so changes hot-reload, and
// (b) resolve the `@shared` alias to the repo root. We deliberately do NOT
// watch the whole repo root (it holds the Next.js app + a node_modules
// junction) — only lib/ is shared into the bundle.

const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const sharedLibRoot = path.resolve(workspaceRoot, "lib");

const config = getDefaultConfig(projectRoot);

// Watch only the shared lib/ folder from the repo root, plus the project.
config.watchFolders = [sharedLibRoot];

// Resolve the app's own node_modules first; the root is the junctioned web
// deps (not used by the bundle) so it stays out of the resolution path.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
];

// `@shared/<x>` → <repoRoot>/<x>. Matches the tsconfig path so types + bundle
// agree.
config.resolver.alias = {
  ...(config.resolver.alias ?? {}),
  "@shared": workspaceRoot,
};

module.exports = config;
