# Grid Dodger — common ops
# Docs: README.md · terraform/README.md · docs/HANDOFF.md

.PHONY: help build-image infra-apply infra-destroy test serve sync-ui

help:
	@echo "Grid Dodger — Make targets"
	@echo ""
	@echo "  Local"
	@echo "    make test              Node + Lambda unit/integration tests"
	@echo "    make serve             npm run serve (:8080)"
	@echo ""
	@echo "  AWS (order matters)"
	@echo "    make infra-apply       1) terraform apply (type yes) — use desired_count=0 first"
	@echo "    make build-image       2) CodeBuild CUDA image → ECR (no local GPU Docker)"
	@echo "    make infra-apply       3) again with desired_count=1 to run g4dn + Decider"
	@echo "    make sync-ui           4) sync game/ + src/ to S3 + CloudFront invalidate"
	@echo "    make infra-destroy     terraform destroy (type yes) — stops g4dn billing"
	@echo ""
	@echo "  Full docs: README.md and terraform/README.md"

# Build Decider CUDA image in AWS CodeBuild (not on your Mac).
build-image:
	./scripts/build_decider_image.sh

# Interactive by default; PLAN=<reviewed.tfplan> applies an inspected saved plan.
infra-apply:
	@echo "==> infra-apply (interactive unless PLAN names an already-reviewed saved plan)"
	@echo "    docs: terraform/README.md"
	cd terraform && terraform init -input=false
	cd terraform && terraform apply $(if $(PLAN),"$(PLAN)",)

# Interactive destroy — type yes to confirm.
infra-destroy:
	@echo "==> infra-destroy (interactive — type yes to confirm)"
	@echo "    note: tears down g4dn ASG, ECS, CF, CodeBuild, ECR (force_delete)"
	cd terraform && terraform init -input=false
	cd terraform && terraform destroy

sync-ui:
	node scripts/sync_ui.mjs

test:
	npm test
	npm run test:lambda

serve:
	npm run serve
