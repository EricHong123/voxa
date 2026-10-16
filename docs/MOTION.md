# Voxa motion design

The monochrome interface uses [Motion for React](https://github.com/motiondivision/motion) 14.3.0 (MIT). This is the animation engine, not a copied UI kit. Upstream guidance: [reduced motion](https://motion.dev/docs/react-use-reduced-motion). Notices are shipped in `licenses/`.

- Navigation and mode selection share a spring-backed selection surface (stiffness 380, damping 30).
- Pages enter over 350 ms, with no exit wait and no retained obsolete controls.
- The record button has press/hover feedback; two rings respond to actual microphone level. The waveform uses transforms instead of animating layout height.
- Feature cards lift and sweep a highlight once on hover. Nothing loops while idle.
- The HUD's five-bar rhythm indicates **recording state**, not measured audio amplitude. A thin processing sweep runs only during recognition, cleanup, insertion or Enter verification. A checkmark is drawn only for the existing successful delivery statuses.
- Transcript snapshots appear immediately. No synthetic character-by-character delay or fabricated model progress. Existing additions/deletions remain visible during cleanup.
- Toasts enter/exit over 180 ms. Keyboard focus and native input ownership are not changed by animation.

## Accessibility and checks

macOS Reduce Motion disables CSS loops, translation, hover/tap movement, ring expansion and checkmark drawing. State text, switch position and final transcript remain available. `MotionConfig reducedMotion="user"`, `useReducedMotion`, and CSS media queries cover the separate cases.

Run `npm run build`, `npm test`, `npm run test:desktop`, and `npm run test:motion`. The last command checks reduced-motion behavior, keyboard switch operation, usable voice controls and readable final text, then captures synthetic HUD frames into ignored `artifacts/motion-frames/`. It does not access the microphone, write into another app, or claim transcription speed. The README GIF is made from these frames.
