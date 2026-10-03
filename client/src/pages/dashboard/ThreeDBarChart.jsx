import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Bright, high-contrast colors match the stepped reference chart while still
// allowing API-provided colors to override them for other chart instances.
const BAR_COLORS = ['#35B5E4', '#A5CF12', '#FF922B', '#E74659', '#A70A4F', '#1262A8', '#19A974', '#F0B429'];

function normaliseData(data) {
  return (Array.isArray(data) ? data : [])
    .map((item, index) => ({
      key: item.key || item.month || item.name || `bar-${index}`,
      label: item.month || item.name || `Item ${index + 1}`,
      value: Math.max(0, Number(item.count ?? item.value ?? 0) || 0),
      color: item.color || BAR_COLORS[index % BAR_COLORS.length],
    }));
}

export default function ThreeDBarChart({ data, unit = 'sessions', emptyMessage = 'No chart data available', compact = false }) {
  const mountRef = useRef(null);
  const barsRef = useRef([]);
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());
  const [hovered, setHovered] = useState(null);
  const [selectedKey, setSelectedKey] = useState(null);
  const chartData = useMemo(() => normaliseData(data), [data]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !chartData.length) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#162033');

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    // Start square-on so the bars read clearly; orbit controls still allow a 3D inspection.
    // A small horizontal offset exposes the top and right face of each bar
    // without turning the chart into a side-on view.
    camera.position.set(3.7, 3.45, compact ? 10.8 : 9.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.shadowMap.enabled = false;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    renderer.__threeCamera = camera;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 5;
    controls.maxDistance = 13;
    controls.maxPolarAngle = Math.PI / 2.02;
    controls.target.set(0, 1.55, 0);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xCBD5E1, 2.1));
    const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
    keyLight.position.set(-4, 8, 5);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0xBFD9FF, 1.4);
    rimLight.position.set(5, 3, -3);
    scene.add(rimLight);

    const maxValue = Math.max(...chartData.map((item) => item.value), 1);
    const step = Math.max(1.05, Math.min(1.38, 8.2 / chartData.length));
    const barWidth = Math.min(0.78, step * 0.64);
    const barDepth = Math.max(0.48, barWidth * 0.78);
    const chartGroup = new THREE.Group();
    // The dashboard chart is intentionally wide. Scale the bar group across
    // that available width so the plot does not sit as a small island in the
    // middle of its card.
    chartGroup.scale.x = Math.min(1.55, Math.max(1.2, 10 / Math.max(chartData.length, 1)));
    const bars = [];

    chartData.forEach((item, index) => {
      const height = item.value > 0 ? Math.max(0.16, (item.value / maxValue) * 3.85) : 0.08;
      const x = (index - (chartData.length - 1) / 2) * step;
      const color = new THREE.Color(item.color);
      const side = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.04 });
      const darkSide = new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(0.66), roughness: 0.52, metalness: 0.02 });
      const top = new THREE.MeshStandardMaterial({ color: color.clone().lerp(new THREE.Color('#FFFFFF'), 0.34), roughness: 0.3, metalness: 0.06 });
      const bar = new THREE.Mesh(new THREE.BoxGeometry(barWidth, height, barDepth), [side, darkSide, top, darkSide, side, darkSide]);
      bar.position.set(x, height / 2, 0);
      bar.userData = { ...item, height, baseColor: item.color };
      chartGroup.add(bar);
      bars.push(bar);

    });

    scene.add(chartGroup);
    barsRef.current = bars;

    const handleCanvasPointerMove = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(pointerRef.current, camera);
      const hit = raycasterRef.current.intersectObjects(barsRef.current, true)[0];
      if (!hit) {
        setHovered(null);
        renderer.style.cursor = 'grab';
        return;
      }
      setHovered({ ...hit.object.userData, x: event.clientX - rect.left, y: event.clientY - rect.top });
      renderer.style.cursor = 'pointer';
    };
    const handleCanvasPointerLeave = () => {
      setHovered(null);
      renderer.style.cursor = 'grab';
    };
    renderer.domElement.addEventListener('pointermove', handleCanvasPointerMove);
    renderer.domElement.addEventListener('pointerleave', handleCanvasPointerLeave);

    const resize = () => {
      const width = mount.clientWidth || 1;
      const height = mount.clientHeight || 1;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(animate);
    };
    let animationFrame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointermove', handleCanvasPointerMove);
      renderer.domElement.removeEventListener('pointerleave', handleCanvasPointerLeave);
      controls.dispose();
      scene.traverse((object) => {
        if (object.isMesh) {
          object.geometry?.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => {
            material?.map?.dispose();
            material?.dispose();
          });
        }
        if (object.isSprite) {
          object.material?.map?.dispose();
          object.material?.dispose();
        }
      });
      renderer.dispose();
      delete renderer.__threeCamera;
      renderer.domElement.remove();
      barsRef.current = [];
    };
  }, [chartData, compact]);

  if (!chartData.length) {
    return <div className="three-d-bar-empty">{emptyMessage}</div>;
  }

  const activeItem = hovered || chartData.find((item) => item.key === selectedKey);

  return (
    <div
      className="three-d-bar-chart"
      role="img"
      aria-label={`Interactive 3D bar chart showing ${chartData.length} ${unit}`}
    >
      <div
        ref={mountRef}
        className="three-d-bar-canvas"
        onClick={() => {
          if (hovered?.key) setSelectedKey((current) => current === hovered.key ? null : hovered.key);
        }}
      />
      {activeItem && (
        <div className="three-d-bar-tooltip" style={{ left: activeItem.x ?? '50%', top: activeItem.y ?? 16 }}>
          <strong>{activeItem.label}</strong>
          <span>{activeItem.value} {unit}</span>
        </div>
      )}
      <div className="three-d-bar-hint">Drag to orbit · Scroll to zoom · Hover or select a bar for details</div>
      <div className="three-d-bar-legend" aria-label="Chart data">
        {chartData.map((item) => (
          <button
            key={item.key}
            type="button"
            className={selectedKey === item.key ? 'is-selected' : ''}
            onClick={() => setSelectedKey((current) => current === item.key ? null : item.key)}
          >
            <i style={{ backgroundColor: item.color }} aria-hidden="true" />
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </button>
        ))}
      </div>
      <ul className="sr-only">
        {chartData.map((item) => <li key={`accessible-${item.key}`}>{item.label}: {item.value} {unit}</li>)}
      </ul>
    </div>
  );
}
