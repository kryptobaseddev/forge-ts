# Type-Safe CLI Frameworks for TypeScript/Node.js (March 2026)

Research conducted for **forge-ts** -- a developer tool requiring both human-friendly AND LLM-agent-friendly design.

---

## Executive Summary

For a dual-audience CLI (human + LLM agent), **no existing framework provides agent-first design out of the box**. The best strategy is to choose a framework with strong type safety and lightweight footprint, then layer structured output (`--json` mode), machine-readable errors, and schema introspection on top.

**Top recommendation for forge-ts**: **citty** or **commander + @commander-js/extra-typings** as the parsing foundation, with a custom output layer that implements agent-first patterns. If you want maximum type safety and are willing to accept ecosystem weight, **@effect/cli** or **Stricli** deserve serious consideration.

---

## Framework Comparison Matrix

| Framework | Version | Weekly Downloads | Bundle (min+gz) | Deps | Type Safety | Subcommands | Auto Help | Active |
|---|---|---|---|---|---|---|---|---|
| **commander** | 14.0.2 | 275.7M | 11.3 kB | 0 | Medium* | Yes | Yes | Yes |
| **citty** | 0.2.1 | 15.8M | 2.9 kB | 0 | High | Yes | Yes | Yes |
| **clipanion** | 4.0.0-rc.4 | 4.4M | 10.0 kB | 1 (typanion) | Very High | Yes | Yes | Slow |
| **clerc** | 0.44.0 | 1,015 | 18.3 kB | 7 | High | Yes | Plugin | Stale |
| **@oclif/core** | 4.9.0 | 5.0M | Large (~85ms cold) | ~28 | Medium-High | Yes | Yes | Yes |
| **@effect/cli** | 0.73.2 | 118K | Large (needs effect) | 3+ | Extreme | Yes | Yes | Yes |
| **@stricli/core** | 1.2.5 | 159K | 9.7 kB | 0 | Very High | Yes | Yes | Yes |

*Commander reaches "High" with the `@commander-js/extra-typings` companion package.

Download data: npm registry, week of 2026-03-10 to 2026-03-16.

---

## Detailed Framework Analysis

### 1. Commander.js (v14.0.2)

**The veteran. Massive ecosystem, zero dependencies, universally understood.**

- **Type Safety**: Built-in TypeScript types are basic. The separate `@commander-js/extra-typings` package (requires TS 5.0+) infers option/argument types through the builder chain into action handlers. This is opt-in and adds some type noise in editor tooltips.
- **Structured Output**: None built-in. You must implement `--json` yourself.
- **Subcommands**: Full support, including nested subcommands.
- **Agent Friendliness**: Low out of the box. No structured error handling, no JSON mode, no schema introspection. But the ubiquity means every LLM has extensive training data on Commander patterns.
- **Pros**: Zero deps, 275M weekly downloads, battle-tested, enormous community.
- **Cons**: Type safety is an afterthought (separate package), no structured output layer, imperative API.
- **Node.js**: Requires v20+.

### 2. citty (v0.2.1) -- UnJS

**Lightweight, modern, TypeScript-first. The UnJS ecosystem darling.**

- **Type Safety**: High. Args are defined declaratively with types (`string`, `boolean`, `enum`), and the framework infers them into the `run` handler. Optional args correctly type as `T | undefined`. Enum args produce union types. No casts needed.
- **Structured Output**: None built-in.
- **Subcommands**: Yes, with lazy-loadable subcommands via `Resolvable<T>` (function, promise, or async function).
- **Agent Friendliness**: Low built-in, but the tiny size and clean architecture make it easy to wrap.
- **Pros**: 2.9 kB gzipped (!), zero deps, ESM-only, uses `node:util.parseArgs` internally, clean API, plugins (v0.2.0+), `meta.hidden` for internal commands, cleanup hooks.
- **Cons**: v0.2.x (still pre-1.0), smaller community than Commander, no decorator support.
- **Breaking in v0.2.0**: ESM-only, switched to `node:util.parseArgs`.

### 3. Clipanion (v4.0.0-rc.4) -- Yarn

**Class-based, decorator-driven, FSM-powered. Maximum type safety through OOP patterns.**

- **Type Safety**: Very high. Commands are classes extending `Command`. Options are class properties decorated with `Option.String()`, `Option.Boolean()`, etc. Types flow naturally through class properties. Integrates with Typanion for runtime validation.
- **Structured Output**: None built-in.
- **Subcommands**: Excellent. Nested commands like `yarn workspaces list` are first-class. FSM-based resolution is fast and handles ambiguity well.
- **Agent Friendliness**: Low built-in.
- **Pros**: Battle-tested in Yarn, FSM parser is fast and handles edge cases, no runtime deps, transparent option proxying, good help output.
- **Cons**: Still on RC (v4.0.0-rc.4 -- has been in RC for a long time), requires `experimentalDecorators`, class-based pattern is heavier than functional, slower release cadence.

### 4. Clerc (v0.44.0)

**Full-featured, plugin-based, chainable API.**

- **Type Safety**: High. Strongly-typed with camelCase conversion. Uses `@clerc/parser` for typed argument parsing.
- **Structured Output**: None built-in.
- **Subcommands**: Yes.
- **Agent Friendliness**: Low.
- **Pros**: Plugin system (help, completions, version, not-found, strict-flags), chainable API, works on Node/Deno/Bun.
- **Cons**: **Effectively abandoned** -- last published ~1 year ago, only 1,015 weekly downloads, 16 dependents. 18.3 kB gzipped with 7 deps. Pre-1.0 (v0.44.0). **Not recommended for new projects.**

### 5. oclif (v4.9.0 / @oclif/core) -- Salesforce

**Enterprise-grade, plugin-based, generator-driven. Powers Heroku and Salesforce CLIs.**

- **Type Safety**: Medium-High. TypeScript-first, but uses a static `flags` property pattern with type helpers rather than full inference. You declare flags with `Flags.string()`, `Flags.boolean()`, etc., and types are inferred in the `run()` method.
- **Structured Output**: **Partial built-in.** oclif has `this.log()` and `this.logJson()` patterns. The `--json` flag pattern is documented and used in Salesforce CLI. `ux.styledJSON()` for formatted JSON output.
- **Subcommands**: Excellent. Directory-based command discovery, multi-command CLIs are the default pattern.
- **Agent Friendliness**: Medium. JSON output exists in the ecosystem, plugin architecture allows extending. Salesforce CLI itself has `--json` on most commands.
- **Pros**: Enterprise-proven, plugin ecosystem, auto-updating installers, code generation, large community (5M weekly downloads), `--json` patterns exist.
- **Cons**: Heavy (~28 deps, ~85ms cold start), opinionated directory structure, generator-driven (less flexible), significant boilerplate.

### 6. @effect/cli (v0.73.2) -- Effect Ecosystem

**Maximum type safety through algebraic effects. The functional programming approach.**

- **Type Safety**: Extreme. Uses Effect's `Schema` module for argument/option validation with full static type inference. Commands are composed algebraically. Every parsing result is an Effect, meaning errors are tracked at the type level. This is the most type-safe option by far.
- **Structured Output**: Not built-in as a `--json` flag, but the Effect pattern of returning structured `Effect<A, E, R>` values makes it trivial to serialize results. Errors are structured by design.
- **Subcommands**: Yes, through command composition.
- **Agent Friendliness**: Medium-High potential. The structured error handling and typed results are inherently agent-friendly once you add a serialization layer. Built-in Wizard Mode for interactive guidance.
- **Pros**: Extreme type safety, Schema-based validation, structured errors by default, works on Node/Bun/browser, wizard mode, auto-generated help + version.
- **Cons**: **Requires buying into the Effect ecosystem** (effect, @effect/platform, @effect/printer). Large transitive dependency tree. Steep learning curve. Pre-1.0. The Effect mental model is a significant commitment.

### 7. Commander + Zod Patterns

**Not a framework -- a pattern. Combine Commander's parsing with Zod's validation.**

Several libraries bridge this gap:

| Library | Approach |
|---|---|
| **Manual pattern** | Parse with Commander, validate with `z.object({...}).parse(opts)` in action handler |
| **zod-commander** | Dedicated bridge: define Zod schemas, `.describe()` becomes help text, `.default()` sets defaults |
| **zod-command** | Full Zod-powered CLI framework with middleware, plugins, config files |
| **zod-opts** | Argument parsing + validation with Zod |

- **Type Safety**: High. Zod provides runtime validation AND static type inference. `z.infer<typeof schema>` gives you the type.
- **Structured Output**: None built-in, but Zod schemas double as output schemas.
- **Agent Friendliness**: Medium. Zod schemas can be serialized to JSON Schema, enabling schema introspection for agents.
- **Pros**: Zod is already in most TypeScript projects, runtime validation catches hallucinated inputs, schemas are reusable for both input validation and output typing.
- **Cons**: Glue code required, no single unified framework, `zod-commander` and friends are small/niche packages.

### Bonus: Stricli (v1.2.5) -- Bloomberg

**Zero-dependency, type-safe, lazy-loading. A serious contender.**

- **Type Safety**: Very high. Types for named flags and positional arguments are defined once and flow through the entire application. No decorators needed, no class inheritance.
- **Structured Output**: None built-in.
- **Subcommands**: Yes, with lazy-loaded implementations (async imports, code splitting).
- **Agent Friendliness**: Low built-in, but the context-object pattern makes dependency injection and testing easy.
- **Pros**: Zero deps, 9.7 kB gzipped, multi-runtime (Node/Bun/Deno), ESM+CJS, JS-powered autocomplete (not shell-dependent), excellent testability via context DI, Bloomberg backing.
- **Cons**: Smaller community (159K weekly downloads), less training data for LLMs, more verbose API.

---

## "LLM Agent-First" CLI Design: State of the Art (March 2026)

### The Emerging Consensus

Multiple authoritative sources (GitLab, InfoQ, Justin Poehnelt, DEV Community) converge on a clear set of patterns for agent-friendly CLI design. **No existing CLI framework implements these patterns natively.** This is a greenfield opportunity.

### Core Design Principles

**1. Structured Output as API Contract**
```
# Every command supports --output json (or --json)
forge task list --output json
# JSON to stdout, everything else to stderr
# Output schema is versioned and validated in CI
```

**2. Machine-Readable Errors**
```json
{
  "error": {
    "code": "AUTH_EXPIRED",
    "message": "Authentication token expired",
    "retryable": true,
    "category": "auth",
    "suggestions": ["Run 'forge auth refresh'"]
  }
}
```

**3. Standardized Exit Codes**
| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | General failure |
| 2 | Usage/syntax error |
| 3 | Auth error |
| 4 | Not found |
| 5 | Conflict |
| 130 | Interrupted (SIGINT) |

**4. Runtime Capability Discovery**
```bash
forge --agent-info  # Returns JSON describing all capabilities
forge schema task.create  # Returns JSON Schema for the command's input
forge --help --format json  # Machine-parseable help
```

**5. JSON Input for Complex Operations**
```bash
# Instead of: forge task create --title "My Task" --assignee "user" --labels "bug,urgent"
# Accept:
echo '{"title":"My Task","assignee":"user","labels":["bug","urgent"]}' | forge task create --json
```

**6. Progress as JSON Lines (NDJSON)**
```jsonl
{"type":"progress","step":1,"total":5,"message":"Fetching dependencies..."}
{"type":"progress","step":2,"total":5,"message":"Compiling..."}
{"type":"result","data":{"compiled":true,"artifacts":["dist/index.js"]}}
```

**7. Non-Interactive Mode**
- `--yes` / `--force` to skip confirmations
- `NO_PROMPT=true` environment variable
- TTY detection: if no TTY, default to non-interactive

**8. Safety Rails for Agent Input**
- Input hardening against path traversal, control characters, URL encoding
- `--dry-run` for all mutations with structured diff output
- Treat agent input as potentially adversarial (hallucinations)

**9. Skill/Documentation Files**
- `SKILL.md` files with YAML frontmatter encoding invariants
- "Always use --dry-run for mutations"
- "Confirm before write/delete operations"

**10. Multi-Surface Exposure**
- Same binary serves CLI, MCP, and extension interfaces
- Environment variable authentication for headless contexts

### CLI vs MCP Trade-offs

| Aspect | CLI | MCP |
|---|---|---|
| **Token cost** | Only when invoked | Tool definitions always in context |
| **Type safety** | Schema introspection needed | Built into protocol |
| **Discovery** | --help, --agent-info | Automatic via tool listing |
| **Shell escaping** | You handle it | Protocol handles it |
| **Streaming** | NDJSON to stdout | Protocol-native |
| **Adoption** | Universal (any shell) | Requires MCP-capable agent |

**Recommendation**: Support both. CLI as the primary interface, with MCP as an optional transport.

### Frameworks Designed for AI Agents

- **CLI-Anything** (github.com/HKUDS/CLI-Anything): Generates CLIs from natural language with `--json` flag on all commands, unified REPL, and `--help`/`which` discovery.
- **Linearis**: A Linear.app CLI explicitly designed for both humans and LLM agents, with JSON output, smart ID resolution, and optimized GraphQL queries.
- **No general-purpose framework** targets agent-first design yet. This is a gap in the ecosystem.

---

## Recommendation for forge-ts

### Decision Framework

| Priority | Best Choice | Rationale |
|---|---|---|
| Smallest footprint + type safety | **citty** | 2.9 kB, zero deps, full type inference |
| Maximum ecosystem + compatibility | **commander + extra-typings** | 275M downloads, every LLM knows it |
| Maximum type safety (functional) | **@effect/cli** | Extreme type safety, structured errors |
| Maximum type safety (zero deps) | **Stricli** | Bloomberg-backed, zero deps, 9.7 kB |
| Enterprise plugin ecosystem | **oclif** | Plugin system, JSON patterns exist |

### Suggested Architecture for forge-ts

```
forge-ts/
  src/
    cli/
      framework/        # Thin wrapper around chosen framework
        output.ts       # --json / --human output routing
        errors.ts       # Structured error codes + machine-readable format
        schema.ts       # Runtime schema introspection (JSON Schema export)
        progress.ts     # NDJSON progress streaming
      commands/
        task/
          create.ts     # Each command returns typed Result<T>
          list.ts
      agent/
        skill.md        # Agent-specific documentation
        agent-info.ts   # --agent-info capability discovery
    mcp/                # MCP server wrapping same commands
```

**Key architectural decision**: Commands return typed result objects, NOT formatted strings. The output layer decides format (JSON vs human-readable) based on `--output` flag. This makes the same command work for both humans and agents.

### My Ranking for forge-ts Specifically

1. **citty** -- Lightest weight, best type inference, modern ESM-only, UnJS ecosystem alignment. Layer agent patterns on top.
2. **Stricli** -- If you want zero deps + very strong types + lazy loading. Bloomberg pedigree.
3. **commander + extra-typings + zod** -- If ecosystem familiarity and LLM training data coverage matter most.
4. **@effect/cli** -- If you are already using or plan to use Effect. Overkill otherwise.
5. **oclif** -- Only if you need the plugin ecosystem. Too heavy for a single tool.
6. **clipanion** -- Stuck in RC, decorator requirement is a friction point.
7. **clerc** -- Abandoned. Do not use.

---

## Sources

- [Commander.js GitHub](https://github.com/tj/commander.js/)
- [Commander.js Extra Typings](https://github.com/commander-js/extra-typings)
- [citty - UnJS](https://github.com/unjs/citty)
- [citty npm](https://www.npmjs.com/package/citty)
- [Clipanion GitHub](https://github.com/arcanis/clipanion)
- [Clerc GitHub](https://github.com/clercjs/clerc)
- [oclif.io](https://oclif.io/)
- [@oclif/core GitHub](https://github.com/oclif/core)
- [@effect/cli npm](https://www.npmjs.com/package/@effect/cli)
- [Effect CLI DeepWiki](https://deepwiki.com/Effect-TS/effect/8.1-cli-framework)
- [Stricli - Bloomberg](https://bloomberg.github.io/stricli/)
- [Stricli GitHub](https://github.com/bloomberg/stricli)
- [zod-commander on JSR](https://jsr.io/@roman910dev/zod-commander)
- [zod-command GitHub](https://github.com/TimMikeladze/zod-command)
- [GitLab CLI Agent-Friendliness Issue](https://gitlab.com/gitlab-org/cli/-/work_items/8177)
- [You Need to Rewrite Your CLI for AI Agents - Justin Poehnelt](https://justin.poehnelt.com/posts/rewrite-your-cli-for-ai-agents/)
- [Writing CLI Tools That AI Agents Actually Want to Use - DEV Community](https://dev.to/uenyioha/writing-cli-tools-that-ai-agents-actually-want-to-use-39no)
- [Keep the Terminal Relevant: Patterns for AI Agent Driven CLIs - InfoQ](https://www.infoq.com/articles/ai-agent-cli/)
- [Linearis - A Linear CLI Built for Humans and LLM Agents](https://zottmann.org/2025/09/03/linearis-my-linear-cli-built.html)
- [CLI-Anything GitHub](https://github.com/HKUDS/CLI-Anything)
- [Bundlephobia](https://bundlephobia.com)
- [npm download API](https://api.npmjs.org)
