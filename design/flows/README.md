# Flow designs

Source for the "Polyxd flow designs" Claude Design canvas: ten flows (26 artboards, mobile and desktop) redesigned after the gold-set review (research log, 2026-09-20). They use Material 3's real token values from `packages/ds-material3`, so every screen maps onto what the renderer can produce once the gaps they expose are built.

`python3 build.py` writes the artboards and `canvas.json` into `out/project/`. `kit.py` holds the shared building blocks (buttons, fields, chips, avatars, list rows, receipts); `flows.py` holds the screens.

These designs are the reference for the spec, renderer, examples and verifier. They are not model training data: training data comes from open models, so the weights stay clean to publish.
