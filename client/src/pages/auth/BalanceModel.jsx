import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export default function BalanceModel() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 100);
    camera.position.set(0, 0, 3);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = false;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x193b62, 2.2));
    const keyLight = new THREE.DirectionalLight(0xffffff, 3);
    keyLight.position.set(2, 4, 3);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x8ec5ff, 1.4);
    fillLight.position.set(-3, 1, 2);
    scene.add(fillLight);

    let model = null;
    let modelSize = null;
    let disposed = false;
    let animationFrame;
    let lastRenderTime = 0;
    const fitCamera = () => {
      if (!modelSize) return;
      const aspect = camera.aspect || 1;
      const verticalFov = THREE.MathUtils.degToRad(camera.fov);
      const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
      const verticalDistance = (modelSize.y / 2) / Math.tan(verticalFov / 2);
      const horizontalDistance = (modelSize.x / 2) / Math.tan(horizontalFov / 2);
      camera.position.set(0, 0, Math.max(verticalDistance, horizontalDistance) * 1.3);
      camera.lookAt(0, 0, 0);
    };

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load('/tt.glb', (gltf) => {
      if (disposed) {
        gltf.scene.traverse((child) => {
          if (child.isMesh) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
            else child.material?.dispose();
          }
        });
        return;
      }
      model = gltf.scene;
      const bounds = new THREE.Box3().setFromObject(model);
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const modelScale = 1.35 / (Math.max(size.x, size.y, size.z) || 1);
      model.scale.setScalar(modelScale);
      model.position.copy(center).multiplyScalar(-modelScale);
      modelSize = size.multiplyScalar(modelScale);
      scene.add(model);
      fitCamera();
    }, undefined, (error) => {
      console.error('Unable to load the login balance model:', error);
    });

    const resize = () => {
      const width = mount.clientWidth || 1;
      const height = mount.clientHeight || 1;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      fitCamera();
      renderer.setSize(width, height, false);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    const animate = (time) => {
      animationFrame = requestAnimationFrame(animate);
      if (time - lastRenderTime < 33) return;
      lastRenderTime = time;
      if (model) model.rotation.y += 0.002;
      renderer.render(scene, camera);
    };
    animationFrame = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      model?.traverse((child) => {
        if (child.isMesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
          else child.material?.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={mountRef} className="balance-model" />;
}