# @nextlevel/config

Shared TypeScript presets for every workspace.

- `tsconfig.base.json`: strict settings for Node and plain TypeScript packages.
- `tsconfig.react.json`: the base plus JSX and DOM types for React code.

Workspaces extend one of these in their own `tsconfig.json`. There is nothing to test here;
`npm run typecheck` at the root exercises the presets.
