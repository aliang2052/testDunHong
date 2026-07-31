# Round 4 Independent Review

## Delivery integrity

- Delivery archive: `testDunHong_round4_final_complete.zip`
- Size: `12,697,744 bytes`
- SHA-256: `efd91f91206a4042fa16c9ae4aab49617bb9a1650e8a2bfaaca5db3d0ce1a733`
- `unzip -t`: passed.
- `MANIFEST.sha256`: every listed file passed.
- `SHA256SUMS.txt`: every listed file passed.
- Filename and content scans found no credential or secret matches.
- Bundled Three.js and OrbitControls files are byte-identical to the reviewed baseline.

## Reproducible build

The delivered patch applied cleanly to the isolated review worktree. All nine delivered modified source files are byte-identical to the patched worktree.

Running `node mogao/build.js` produced:

- File: `敦煌莫高窟大佛建造全过程.html`
- Size: `1,591,566 bytes`
- SHA-256: `c0d99da0f468e83c8d4629932a38f75b558a85e9f4385ef20032877134cfdaa0`

The rebuilt HTML is byte-identical to `敦煌莫高窟第96窟_互动建造_round4.html` in the delivery archive.

## Independent browser verification

The repository's independent verifier passed every automated gate:

- ready hook
- no embedded video element
- no runtime remote requests
- 16 chapters and 16 keyframes
- chapter click, seek and automatic playback
- play/pause toggle
- 2× speed control
- free-camera toggle
- 390×844 mobile viewport fit
- no page errors

Evidence is stored outside the repository at `mogao-evidence/verification-round4/`, including `report.json`, sixteen keyframes, and `contact.png`.

## Visual judgment

Round 4 is a material improvement over Round 3. It removes the worst camera clipping and giant section planes, makes the cave and transport opening readable, adds a complete mural wall sequence, and keeps the reconstructed nine-storey facade separate from the Buddha.

It does not yet meet the user's hard visual acceptance criterion. The Buddha remains visibly procedural with a bottle-like torso, shallow facial anatomy, and floating-looking tools; the painted state has hard-edged vector-like colour regions; the cliff is dominated by repeated horizontal strata; and the mural and final environment remain flatter and cleaner than the supplied reference video. Functional acceptance passed, but visual acceptance is therefore **failed pending a focused correction round**.

No production deployment was performed.
