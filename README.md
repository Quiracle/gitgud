# GitGud

A browser-based daily game for learning Git by transforming simulated repositories.

The first implementation includes a purpose-built TypeScript Git engine and a basic puzzle UI. It does **not** execute real Git commands or access a filesystem.

## Supported simulator commands

```text
git switch <branch>
git checkout <branch>
git log
git log --all
git merge <branch>
git merge --ff-only <branch>
git cherry-pick <commit>
git revert <commit>
```

## Local development

```bash
pnpm install
pnpm dev
```

Run verification with:

```bash
pnpm test
pnpm build
```

The UI is intentionally foundational and will be redesigned separately. Simulation code lives under `src/engine` and does not depend on React.
