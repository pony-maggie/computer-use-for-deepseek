# Viewport Runtime Resize Design

Goal: Make Viewport Lab visibly and operationally switch the sandbox viewport.

Scope:
- Frontend shows a device-aware sandbox frame for Desktop, Tablet, and Mobile.
- Frontend sends the selected viewport to the backend immediately when changed.
- Backend validates the preset dimensions and forwards the request to the runtime action daemon.
- Runtime resizes the Chromium browser window and updates DevTools emulation metrics when possible.
- The selected viewport remains part of the execution profile for future runs.

Non-goals:
- Reconfiguring Xvfb screen size at runtime.
- Restarting the sandbox container.
- Adding arbitrary custom viewport dimensions.

Acceptance:
- Clicking Mobile changes the center sandbox presentation and reports Mobile 390x844.
- Browser E2E can observe the active label and selected viewport button.
- Backend test proves invalid dimensions are rejected.
- Runtime unit test proves the resize action calls browser/window resize commands.
