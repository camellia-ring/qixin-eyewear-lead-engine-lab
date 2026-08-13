# Design QA — 眼镜客户开发引擎（方案 1）

## Inputs

- Source image: `C:\Users\dongyi\.codex\generated_images\019ff7e3-7b58-75c2-bdcb-5625a1cbd140\exec-9b05fdff-39c3-4940-9648-142e64f0b966.png`
- Source dimensions: 1487 × 1058
- Final implementation screenshot: `C:\Users\dongyi\.codex\visualizations\2026\08\12\019ff7e3-7b58-75c2-bdcb-5625a1cbd140\lead-engine-audit\07-option1-final-1440.png`
- Implementation viewport: 1440 × 1024, desktop Chromium, default `待审核` state, first candidate selected
- Full-view comparison: `C:\Users\dongyi\.codex\visualizations\2026\08\12\019ff7e3-7b58-75c2-bdcb-5625a1cbd140\lead-engine-audit\10-option1-final-comparison.png`
- Focused drawer comparison: `C:\Users\dongyi\.codex\visualizations\2026\08\12\019ff7e3-7b58-75c2-bdcb-5625a1cbd140\lead-engine-audit\11-option1-focused-comparison.png`

## Visual comparison

- Composition matches the selected direction: fixed navigation, campaign/status header, high-density review table, and persistent evidence/review drawer.
- Visual hierarchy matches: white/soft-gray surfaces, QIXIN blue selection accents, blue score/coverage emphasis, orange risk, red rejection, and green approved count.
- Five complete lead rows remain visible at the target desktop viewport; table headers, status badges, evidence coverage, and bottom review controls are not clipped.
- Typography and controls were deliberately enlarged relative to the earlier implementation. Country and company types are localized to Chinese while preserving the selected layout.
- The implementation adds explicit evidence-source and score sections required by the existing evidence-first workflow; these are contained in the drawer and do not disturb the primary scan path.

## Focused checks

- Drawer company identity, score, coverage bar, confidence, signal, risk, notes, disabled approval state, rejection, and keep-pending action align with the reference structure.
- Approval remains visibly disabled when the hard gate is not satisfied.
- Tablet screenshot: `08-option1-final-900.png`; drawer becomes an overlay while the navigation collapses to icons.
- Mobile screenshot: `09-option1-final-mobile.png`; the selected lead drawer becomes the primary view, with no viewport-level horizontal overflow.

## Comparison history

1. `04-option1-implementation.png` — initial implementation.
2. `05-option1-compare-pass1.png` — found clipped status and off-screen review controls.
3. `06-option1-implementation-pass2.png` — fixed viewport shell, condensed filters, and persistent review dock.
4. `07-option1-final-1440.png` — finalized column balance, row sizing, localized labels, and concise signal/risk copy.

## Interaction and engineering QA

- Pending rows: 21; rejected rows: 4; approved rows: 0.
- Search narrows to the expected candidate; Campaign status toggles work.
- Campaign, research, import, and CRM export destinations remain available.
- No approve/reject mutation was triggered during QA.
- CRM export remains disabled with zero approved leads.
- Desktop, tablet, and mobile checks reported no viewport-level horizontal overflow.
- Browser console errors: 0. Failed resources: 0.
- Company names resolve to 21 safe `http/https` official-site links, open in a new tab with `noopener noreferrer`, and leave evidence review as a separate action.
- Browser interaction check: the first official-site URL resolved to `https://specsaddict.co.uk/`; selecting the second row's evidence action switched the drawer to Continental Eyewear.
- `npm run check`: passed (typecheck, lint, production build, 6/6 tests).

final result: passed
