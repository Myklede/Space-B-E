import * as THREE from 'three';

// Presentation only: grounded distance sets footfall cadence; physics owns the eye.
export function createWalkCamera({ camera, element, walker, reducedMotion = false, onFootstep }) {
  let stride = 0;
  let bob = 0;
  const previous = { ...walker.pos };
  const mouse = event => {
    if (document.pointerLockElement === element) walker.look(event.movementX, event.movementY);
  };
  const lock = () => {
    const pending = element.requestPointerLock?.();
    pending?.catch?.(() => {});
  };
  document.addEventListener('mousemove', mouse);
  element.addEventListener('click', lock);

  return {
    update(dt) {
      const distance = Math.hypot(walker.pos.x - previous.x, walker.pos.z - previous.z);
      Object.assign(previous, walker.pos);
      if (walker.onGround && distance > 0.0001) {
        stride += distance;
        const stepLength = walker.running ? 0.85 : 0.65;
        while (stride >= stepLength) {
          stride -= stepLength;
          onFootstep?.({ mode: walker.mode, running: walker.running, position: { ...walker.pos } });
        }
        bob += distance * Math.PI / stepLength;
      }
      const eye = walker.eye;
      const amplitude = reducedMotion || !walker.onGround ? 0 : Math.min(0.018, distance / Math.max(dt, 0.001) * 0.01);
      camera.position.set(eye.x, eye.y + Math.sin(bob * 2) * amplitude, eye.z);
      camera.quaternion.setFromEuler(new THREE.Euler(walker.pitch, walker.yaw, 0, 'YXZ'));
    },
    dispose() {
      document.removeEventListener('mousemove', mouse);
      element.removeEventListener('click', lock);
      if (document.pointerLockElement === element) document.exitPointerLock();
    },
  };
}
