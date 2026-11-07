// Keyboard → flight input (TEAM_PROMPT §4 "Cockpit"). Mouse look is handled by the camera rig.
//
//   W/S pitch nose down/up · A/D yaw left/right · Q/E throttle up/down · X cut-off
//   hold Space = brake (auto retrograde burn) · F = toggle Flight Assist · E (landed) = stand up
//
// const controls = createCockpitControls({ target: window, onToggleAssist, onStandUp, isLanded });
// each frame: fc.update(dt, controls.input); controls.endFrame();

export function createCockpitControls({ target = window, onToggleAssist, onStandUp, isLanded } = {}) {
  const down = new Set();
  const input = { pitch: 0, yaw: 0, throttleUp: false, throttleDown: false, cutoff: false, brake: false };

  const refresh = () => {
    input.pitch = (down.has('KeyS') ? 1 : 0) - (down.has('KeyW') ? 1 : 0); // W = nose down
    input.yaw = (down.has('KeyD') ? 1 : 0) - (down.has('KeyA') ? 1 : 0);
    input.throttleUp = down.has('KeyQ');
    input.throttleDown = down.has('KeyE') && !(isLanded?.() ?? false);
    input.brake = down.has('Space');
  };

  const onKeyDown = (e) => {
    if (e.repeat) return;
    if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
    down.add(e.code);
    if (e.code === 'KeyX') input.cutoff = true; // consumed on the next frame
    if (e.code === 'KeyF') onToggleAssist?.();
    if (e.code === 'KeyE' && (isLanded?.() ?? false)) onStandUp?.();
    refresh();
  };
  const onKeyUp = (e) => {
    down.delete(e.code);
    refresh();
  };
  const onBlur = () => {
    down.clear();
    refresh();
  };

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', onBlur);

  return {
    input,
    endFrame() { input.cutoff = false; },
    dispose() {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('blur', onBlur);
    },
  };
}
