# Contributing

Use focused changes and Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`). Preview visual changes before merging them. Run `make test` and, for website changes, `npm run build:pages` and review desktop/tablet/phone layouts.

Never commit credentials, `.env`, Terraform state/plans or real tfvars, account inventories, billing exports, model weights/caches, or private working notes. Use `.env.example` and `terraform/terraform.tfvars.example` as templates. AWS builds and deployments incur charges and are separate from GitHub Pages deployment.

`docs/DECIDER_PATTERN.md` and `examples/tool-selection.mjs` describe the reusable pattern. Keep benchmark limitations and threshold fallback behavior accurate; fixtures do not prove live model performance.
