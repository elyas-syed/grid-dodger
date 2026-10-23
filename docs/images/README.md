# Architecture overview

[PNG](architecture-overview.png) · [SVG](architecture-overview.svg)

Original diagram for the root README, checked against the current browser/controller modules, Make targets and Terraform configuration on 2026-10-17. It shows logical routes, not a complete network topology. The browser runs the game engine and registered movement tools; ECS/EC2 serves Decider choices and Lambda/Bedrock generates recaps.

The design uses generic shapes and service names rather than official AWS icons. It contains no account/resource identifiers or secrets. The illustrated review article has a matching copy and additional decision-loop/build cards in docs/grid-dodger-article/. SVG is supplied for scalable viewing and editing.
