# Scaffold a monorepo project

Read this guide before adding a workspace or changing workspace dependencies,
exports, or Turbo tasks. Examples describe new projects; existing packages are not
migrated automatically. Merge snippets into existing configuration rather than
replacing unrelated settings.

## Choose location and register workspace

| Kind                              | Location                                                    | Root `workspaces` entry        |
| --------------------------------- | ----------------------------------------------------------- | ------------------------------ |
| Major application or service      | `backend/`, `frontend/`, `mobile/`, `admin/`                | Explicit directory per project |
| Shared library or support package | `packages/components/`, `packages/sql/`, `packages/common/` | One `packages/*` glob          |

Use responsibility, not code size, to choose placement. Keep repository operations
in root `scripts/`; do not create a workspace for every script. An existing native
shell inside an application need not become a separate `mobile/` workspace.

For example, root `package.json` can contain:

```json
{
	"workspaces": ["backend", "frontend", "mobile", "admin", "packages/*"]
}
```

List only applications that actually exist. Add missing entries without duplicates;
never enumerate each shared package alongside `packages/*`. Give every workspace a
unique package name. Consumers declare the producer's name with `workspace:*` in
`dependencies` (runtime imports) or `devDependencies` (build-only tooling/contracts).
Import by package name, never through a sibling's `src/` path or a cross-workspace
TypeScript path alias. Turbo derives ordering from package dependencies.

After changing manifests, run `bun install` at root and include `bun.lock` changes.
Use versions consistent with the repository; do not copy template dependencies,
production configuration, or domain logic wholesale.

## Bootstrap package and TypeScript configuration

Every new project starts with its own `package.json`, `tsconfig.json`, and source
entry point. Follow the template SQL package's small ESM manifest and shared TS
preset approach, adding only tools needed by the new project. A minimal starting
manifest for `packages/common` is:

```json
{
	"name": "@repo/common",
	"private": true,
	"type": "module",
	"scripts": {
		"check-types": "tsc --noEmit"
	},
	"devDependencies": {
		"@hyoretsu/configs": "^1.2.35",
		"typescript": "^5.9.3"
	}
}
```

Align these example versions with existing workspace versions when scaffolding.
Start its `tsconfig.json` with:

```json
{
	"extends": "@hyoretsu/configs/ts",
	"compilerOptions": {
		"types": []
	},
	"include": ["src/**/*.ts"],
	"exclude": ["node_modules", "out", "dist"]
}
```

Use a suitable frontend/backend preset for applications. Add `node` or `bun` types
and their dev dependencies only when needed; browser libraries must not inherit
server globals accidentally. The `ts-lib` preset emits declarations by default;
explicitly configure JS emission when a library also exports runtime code.
Framework applications keep their required TS plugins and includes. Do not copy SQL
seed paths or generated includes into packages that have neither.

## Put exported artifacts in out/

Keep handwritten code and public source barrels in `src/`. Every project, library
or application, writes artifacts exported to other projects into its own `out/`:
JS entry points, declarations, generated clients, schemas, and OpenAPI documents.
Public package `exports` must resolve to `out/`, not `src/`. Consumers use produced
artifacts; never hand-edit or commit generated output.

An `export` task produces contracts/codegen artifacts, while `build` produces runtime
code when compilation is required. Choose one owner per output path; do not let
independent tasks overwrite the same files. No placeholder export task or empty
`out/` is needed for projects without exported artifacts.

Runtime application builds can retain framework paths: `.next/`, `dist/`, or native
`target/`. Cache their actual outputs as well. Add `out/` to `.gitignore` so output
is ignored at every workspace depth; add other generated paths as needed. Root-only
`/out/` does not ignore `packages/components/out/`.

### Components library consumed by frontend

Create `packages/components/src/Badge.tsx`:

```tsx
export function Badge({ label }: { label: string }) {
	return <span>{label}</span>;
}
```

Create `packages/components/src/index.ts`:

```ts
export { Badge } from "./Badge.js";
```

Use this `package.json`, aligning versions with the consuming frontend:

```json
{
	"name": "@repo/components",
	"private": true,
	"type": "module",
	"exports": {
		".": {
			"types": "./out/index.d.ts",
			"import": "./out/index.js"
		}
	},
	"scripts": {
		"build": "tsc -p tsconfig.json",
		"check-types": "tsc -p tsconfig.json --noEmit"
	},
	"peerDependencies": {
		"react": "^19"
	},
	"devDependencies": {
		"@hyoretsu/configs": "^1.2.35",
		"@types/react": "^19",
		"react": "^19",
		"typescript": "^5.9.3"
	}
}
```

Use this `tsconfig.json`:

```json
{
	"extends": "@hyoretsu/configs/ts-lib",
	"compilerOptions": {
		"rootDir": "src",
		"outDir": "out",
		"emitDeclarationOnly": false,
		"declaration": true,
		"jsx": "react-jsx",
		"lib": ["ESNext", "DOM", "DOM.Iterable"],
		"types": ["react"]
	},
	"include": ["src/**/*.ts", "src/**/*.tsx"],
	"exclude": ["node_modules", "out"]
}
```

This emits JS and declarations while preserving module boundaries. Keep React a
peer dependency to avoid duplicate runtime instances. Add framework-specific client
directives to interactive components when required by the consumer.

Add `"@repo/components": "workspace:*"` to frontend dependencies, then import
`{ Badge }` from `"@repo/components"`. Do not add another components workspace entry
if `packages/*` already covers it.

## Wire Turbo ordering and caching

Update `turbo.jsonc` whenever introducing a project or producer task. Root scripts
invoke Turbo; workspace scripts invoke their actual tools, never Turbo recursively.
The following task fragments illustrate the components build plus optional contract
exports; preserve existing prerequisites such as generation or variant preparation:

```json
{
	"tasks": {
		"build": {
			"cache": true,
			"dependsOn": ["^build", "^export"],
			"inputs": ["$TURBO_DEFAULT$", "!out/**"],
			"outputs": ["out/**"]
		},
		"export": {
			"cache": true,
			"dependsOn": ["^export"],
			"inputs": ["$TURBO_DEFAULT$", "!out/**"],
			"outputs": ["out/**"]
		},
		"check-types": {
			"dependsOn": ["^build", "^export"],
			"inputs": ["$TURBO_DEFAULT$", "!out/**"],
			"outputs": []
		},
		"dev": {
			"cache": false,
			"persistent": true,
			"dependsOn": ["^build", "^export"]
		}
	}
}
```

- `^build` and `^export` run producers in dependency workspaces before consumers.
  For the example, frontend build, checks, and dev startup wait for components build.
  A same-workspace prerequisite uses `export` rather than `^export`. Add it only
  where that task exists and its artifacts are needed; keep the graph acyclic.
- Keep `src/` and configuration in the input hash. `$TURBO_DEFAULT$` preserves the
  default tracked-file inputs; exclude this task's outputs to avoid self-invalidation.
  Declare inherited root TS configuration through `$TURBO_ROOT$/tsconfig.json` when
  applicable. Include any other files that influence the result.
- Declare artifact-affecting variables through `env` or `globalEnv` so values affect
  cache keys. Pass-through variables are not hashed. Builds and exports must not
  depend on untracked external state or contact a live database.
- Use package-specific overrides for actual output directories, for example
  `frontend#build` with `.next/**` and `!.next/cache/**` for Next, or `dist/**` for Vite.
  Override generic `out/**` where the task does not produce it. Declare emitted TS
  build-info files if incremental compilation uses them; do not cache type-check
  results that depend on undeclared generated inputs.
- Contract-driven generation needs an explicit dependency edge: declare the producer
  as a workspace dependency, then make consumer `generate` depend on `^export` (or a
  specific task such as `backend#export`). Make consumer build/check/dev depend on
  `generate`. Include contract inputs such as `$TURBO_ROOT$/backend/out/openapi.json`
  and declare the generator's actual outputs. Existing source-tree SDK generation
  paths are legacy exceptions; new exported artifacts belong in `out/`.
- Keep persistent dev/start tasks uncached and out of prerequisite chains. Dependency
  builds run once before dev; use explicit watchers when library edits must propagate
  during an active dev session. Never depend on a persistent task from a build.
- Enable caching only for deterministic tasks. Keep mutations, database migrations,
  seeds, deployments, and external side effects out of build/export dependencies and
  mark their tasks uncached. Never run them as scaffold validation.

## Acceptance checklist

1. Confirm workspace discovery with `bunx --no-install turbo ls`; verify unique names,
   root application entries, and the single `packages/*` glob.
2. Inspect `bunx --no-install turbo run build --filter=frontend --dry-run=json`.
   Verify producer tasks precede consumers. Inspect checks/dev/generate similarly
   when those tasks consume produced files.
3. In a local disposable scaffold, start with generated output absent. Run its scoped
   build/export and confirm every public export resolves, declarations exist, and
   consumers build without a pre-existing `out/`.
4. Repeat the identical scoped command: expect a cache hit for deterministic tasks.
   Delete only the scaffold's ignored generated output and repeat: verify the cache
   restores every artifact. A log-only cache hit is insufficient.
5. Change a producer source, configuration, or declared environment value. Confirm
   both producer and dependent consumer invalidate; unrelated packages should retain
   their caches. Restore temporary edits after checking.
6. Check Git ignores and staged paths: no generated output, secrets, or unrelated
   changes. Run relevant application checks through normal project workflow and
   commit hooks. No deployment, remote DB action, or push is part of scaffolding.

## Template notes

- Root workspaces already include `backend`, `frontend`, and `packages/*`; add only
  genuinely new root applications. Preserve generation and `variant:prepare` edges.
- Existing SQL manifest exports `.` from `src/index.ts` and `./typebox` from
  `out/typebox/barrel.ts`, generated from `src/contract.prisma` via
  `prisma contract emit` (`out/prisma/contract.json` and `contract.d.ts`) and
  the custom TypeBox generator. Existing `@template/domain` also exports source. These
  are legacy exceptions, not patterns for new public entry points; no migration is
  included with this guide.
- Backend `export` writes `backend/out/openapi.json`; backend runtime build writes
  `dist/`. Frontend Kubb currently writes `frontend/src/lib/api/generated/`. Never
  edit those generated files. Use the existing SQL export -> backend export ->
  frontend generate chain; new exported artifacts use `out/`.
- Root `.gitignore` already ignores `out/` at every depth. Current Turbo build,
  export, and check-types caching is disabled; audit deterministic inputs before
  enabling caching. Preserve required `generate` and variant preparation behavior.
- New workspaces also require reviewing `scripts/validate-staged.ts`, whose manifest
  list is currently explicit, and affected-package/deployment discovery. Shared
  libraries must not be mistaken for deployable services.
