import * as THREE from 'three';

// Camera -Z faces ship +Y. Mouse look never changes the simulation attitude.
export function createCockpitRig({ camera, element, sensitivity = 0.002, invertY = false, reducedMotion = false }) {
  let yaw = 0, pitch = 0, clock = 0, chase = false;
  const view = new THREE.Quaternion();
  const nose = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  const mouse = e => {
    if (document.pointerLockElement !== element) return;
    yaw = THREE.MathUtils.clamp(yaw - e.movementX * sensitivity, -1.5, 1.5);
    pitch = THREE.MathUtils.clamp(pitch - e.movementY * sensitivity * (invertY ? -1 : 1), -1.1, 1.1);
  };
  const lock = () => { const p = element.requestPointerLock?.(); p?.catch?.(() => {}); };
  document.addEventListener('mousemove', mouse);
  element.addEventListener('click', lock);
  return {
    setChase(value) { chase = value; },
    get chase() { return chase; },
    update(dt, fc, telemetry) {
      clock += dt;
      const q = new THREE.Quaternion(fc.orient.x, fc.orient.y, fc.orient.z, fc.orient.w);
      if (chase) {
        camera.position.set(0, 16, 65).applyQuaternion(q);
        camera.up.set(fc.up.x, fc.up.y, fc.up.z);
        camera.lookAt(0, 4, 0);
      } else {
        const intensity = reducedMotion ? 0 : Math.min(0.012, telemetry.thrust / 4e7 + Math.max(0, telemetry.gLoad - 2) * 0.001);
        view.setFromEuler(new THREE.Euler(pitch + Math.sin(clock * 37) * intensity, yaw + Math.sin(clock * 29) * intensity, 0, 'YXZ'));
        camera.quaternion.copy(q).multiply(nose).multiply(view);
        camera.position.set(fc.forward.x * 12.5, fc.forward.y * 12.5, fc.forward.z * 12.5);
      }
    },
    dispose() {
      document.removeEventListener('mousemove', mouse);
      element.removeEventListener('click', lock);
      if (document.pointerLockElement === element) document.exitPointerLock();
    },
  };
}
