// Ready textures/materials alone are not enough: wait for their first rendered frame.
export function waitForRenderedScene(instance, onReady) {
  let active = true, observer;
  instance.scene.executeWhenReady(() => {
    if (!active || instance.disposed) return;
    observer = instance.scene.onAfterRenderObservable.addOnce(() => {
      if (active && !instance.disposed) onReady();
    });
  });
  return () => { active = false; if (observer) instance.scene.onAfterRenderObservable.remove(observer); };
}
