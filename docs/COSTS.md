# Running costs

**Current status — 2026-10-17:** the project AWS stack and audited project resources have been fully removed. The demo is offline. The estimates below apply if the stack is redeployed; previously accrued usage can still appear on later bills.

Estimate checked **2026-10-17** for **us-east-1**, USD, continuous operation over **730 hours/month**. These are resource estimates, not account bills. Credits, tax, and unusually heavy traffic are excluded.

Daily estimates cover **24 hours** of continuous operation; monthly estimates use **730 hours**. Daily storage and fixed-service amounts are the monthly estimate × 24/730, rounded for planning.

| Component | Basis | Daily estimate | Monthly estimate |
|---|---|---:|---:|
| Decider GPU | One Linux `g4dn.xlarge`, $0.526/hour | $12.62 | $383.98 |
| Application Load Balancer | $0.0225/hour; capacity usage extra | $0.54 | $16.43 |
| Public IPv4 | Three addresses × $0.005/hour | $0.36 | $10.95 |
| EBS gp3 | 80 GB × $0.08/GB-month | $0.21 | $6.40 |
| WAF | One ACL + one rule; requests extra | $0.20 | $6.00 |
| ECR image hosting | Approximately 3.43 GB × $0.10/GB-month | ~$0.01 | ~$0.34 |
| **Fixed baseline** | Before variable usage | **~$13.94** | **~$424.10** |
| Variable services | Light-traffic planning allowance, below | ~$0.03–0.20 | ~$1–6 |
| **Planning total** | Builds extra | **~$13.97–14.14** | **~$425–430** |

Plan on approximately **$0.58–0.59/hour**, **$14/day**, or **$425–430/month** while the complete stack remains running. Builds are additional one-off costs. Actual totals vary with traffic and calendar month length; the allowance is not a spending cap.

## Variable and occasional charges

- **Bedrock Nova Lite:** approximately $0.06/million input tokens and $0.24/million output tokens. A 500-input/100-output-token recap costs about $0.000054; 1,000 such recaps cost about $0.054.
- **CodeBuild:** Linux large builds cost $0.02/minute, rounded to minutes. A six-minute image build is about $0.12. UI-only deployment does not rebuild the image.
- **CloudFront, S3, and logs:** storage, requests, delivery, and CloudWatch ingestion/retention vary with usage.
- **Lambda and API Gateway:** recap requests and execution duration add usage charges.
- **ALB capacity and WAF requests:** add charges beyond the base amounts above.

ECS on EC2 has no additional orchestration fee here. ECR stores the container image; GPU execution is charged separately. Same-region ECR image pulls have no ECR transfer-out charge. The design has no NAT gateway.

Scaling GPU capacity to zero removes GPU compute costs but leaves supporting services and storage. Full teardown also deletes the app's ECR images. Budget alerts and request limits do not stop spending. See [operations](../terraform/README.md) before changing capacity.

## Price references

[AWS EC2](https://aws.amazon.com/ec2/instance-types/g4/) · [ALB](https://aws.amazon.com/elasticloadbalancing/pricing/) · [IPv4](https://aws.amazon.com/vpc/pricing/) · [EBS](https://aws.amazon.com/ebs/pricing/) · [WAF](https://aws.amazon.com/waf/pricing/) · [ECR](https://aws.amazon.com/ecr/pricing/) · [CodeBuild](https://aws.amazon.com/codebuild/pricing/) · [Bedrock](https://aws.amazon.com/bedrock/pricing/)

Recheck rates, resource counts, and workload assumptions before budgeting. This document intentionally contains no account identifiers, billing exports, resource identifiers, or credentials.
