import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

function normaliseData(data) {
  return (Array.isArray(data) ? data : [])
    .map((item, index) => ({
      key: item.key || `segment-${index}`,
      label: item.label || item.name || `Segment ${index + 1}`,
      value: Math.max(0, Number(item.value) || 0),
      color: item.color || ['#3B82F6', '#22D3EE', '#F59E0B', '#64748B'][index % 4],
    }))
    .filter((item) => item.value > 0);
}

function createWedgeGeometry(innerRadius, outerRadius, startAngle, endAngle, depth) {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const indices = [];
  const steps = 48;
  const halfDepth = depth / 2;
  const pushVertex = (radius, angle, y) => {
    positions.push(radius * Math.cos(angle), y, radius * Math.sin(angle));
    return (positions.length / 3) - 1;
  };
  const addQuad = (a, b, c, d) => {
    indices.push(a, b, c, a, c, d);
  };

  for (let index = 0; index < steps; index += 1) {
    const a0 = startAngle + ((endAngle - startAngle) * index) / steps;
    const a1 = startAngle + ((endAngle - startAngle) * (index + 1)) / steps;
    const topOuter0 = pushVertex(outerRadius, a0, halfDepth);
    const topOuter1 = pushVertex(outerRadius, a1, halfDepth);
    const topInner0 = pushVertex(innerRadius, a0, halfDepth);
    const topInner1 = pushVertex(innerRadius, a1, halfDepth);
    const bottomOuter0 = pushVertex(outerRadius, a0, -halfDepth);
    const bottomOuter1 = pushVertex(outerRadius, a1, -halfDepth);
    const bottomInner0 = pushVertex(innerRadius, a0, -halfDepth);
    const bottomInner1 = pushVertex(innerRadius, a1, -halfDepth);

    // Keep each face wound toward its visible side. The previous winding
    // pointed several surfaces inward, which made WebGL cull parts of the top
    // face and show triangulated fragments from the hidden interior.
    addQuad(topOuter0, topInner0, topInner1, topOuter1);
    addQuad(bottomOuter0, bottomOuter1, bottomInner1, bottomInner0);
    addQuad(topOuter0, topOuter1, bottomOuter1, bottomOuter0);
    addQuad(topInner0, bottomInner0, bottomInner1, topInner1);

    if (index === 0) addQuad(topInner0, topOuter0, bottomOuter0, bottomInner0);
    if (index === steps - 1) addQuad(topOuter1, topInner1, bottomInner1, bottomOuter1);
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export default function ThreeDDonutChart({ data, total, emptyMessage = 'No status data available' }) {
  const mountRef = useRef(null);
  const meshesRef = useRef([]);
  const hoveredIndexRef = useRef(-1);
  const [hovered, setHovered] = useState(null);
  const chartData = useMemo(() => normaliseData(data), [data]);
  const distributionTotal = chartData.reduce((sum, item) => sum + item.value, 0);
  const resolvedTotal = total ?? distributionTotal;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !chartData.length || !distributionTotal) return undefined;

    const scene = new THREE.Scene();
    const width = mount.clientWidth || 200;
    const height = mount.clientHeight || 210;
    const camera = new THREE.PerspectiveCamera(31, width / height, 0.1, 100);
    camera.position.set(0, 3.1, 5.4);
    camera.lookAt(0, 0.05, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.minPolarAngle = Math.PI / 3.6;
    controls.maxPolarAngle = Math.PI / 2.15;
    controls.target.set(0, 0.05, 0);

    scene.add(new THREE.AmbientLight(0xFFFFFF, 0.65));
    const keyLight = new THREE.DirectionalLight(0xFFFFFF, 1.3);
    keyLight.position.set(4, 6, 3);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x4488FF, 0.45);
    rimLight.position.set(-3, 4, -2);
    scene.add(rimLight);
    scene.add(new THREE.HemisphereLight(0x6688CC, 0x111122, 0.35));

    const innerRadius = 0.72;
    const outerRadius = 1.42;
    const depth = 0.3;
    const gap = 0.09;
    const meshes = [];
    let angle = Math.PI / 2;

    chartData.forEach((item, index) => {
      const span = (item.value / distributionTotal) * Math.PI * 2;
      const segmentGap = Math.min(gap, span * 0.35);
      const startAngle = angle + segmentGap / 2;
      const endAngle = angle + span - segmentGap / 2;
      const middleAngle = (startAngle + endAngle) / 2;
      const geometry = createWedgeGeometry(innerRadius, outerRadius, startAngle, endAngle, depth);
      const material = new THREE.MeshPhongMaterial({
        color: new THREE.Color(item.color),
        shininess: 75,
        specular: new THREE.Color(0x445577),
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData = { index, key: item.key };
      scene.add(mesh);
      meshes.push({ mesh, item, middleAngle, targetY: 0, targetScale: 1, targetX: 0, targetZ: 0 });
      angle += span;
    });
    meshesRef.current = meshes;

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2(-10, -10);
    const handlePointerMove = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(meshes.map((entry) => entry.mesh), false)[0];
      const nextIndex = hit ? hit.object.userData.index : -1;
      if (nextIndex === hoveredIndexRef.current) return;
      hoveredIndexRef.current = nextIndex;
      renderer.domElement.style.cursor = nextIndex >= 0 ? 'pointer' : 'grab';
      if (nextIndex >= 0) {
        const item = chartData[nextIndex];
        setHovered({ ...item, x: event.clientX - rect.left, y: event.clientY - rect.top });
      } else {
        setHovered(null);
      }
    };
    const handlePointerLeave = () => {
      pointer.set(-10, -10);
      hoveredIndexRef.current = -1;
      setHovered(null);
      renderer.domElement.style.cursor = 'grab';
    };
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerleave', handlePointerLeave);

    const resize = () => {
      const nextWidth = mount.clientWidth || 200;
      const nextHeight = mount.clientHeight || 210;
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight, false);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);

    let animationFrame;
    const animate = () => {
      controls.update();
      const activeIndex = hoveredIndexRef.current;
      meshes.forEach((entry) => {
        const isActive = entry.mesh.userData.index === activeIndex;
        entry.targetY = isActive ? 0.12 : activeIndex >= 0 ? -0.025 : 0;
        entry.targetScale = isActive ? 1.16 : activeIndex >= 0 ? 0.88 : 1;
        entry.targetX = isActive ? Math.cos(entry.middleAngle) * 0.07 : 0;
        entry.targetZ = isActive ? -Math.sin(entry.middleAngle) * 0.07 : 0;
        entry.mesh.position.y += (entry.targetY - entry.mesh.position.y) * 0.1;
        entry.mesh.position.x += (entry.targetX - entry.mesh.position.x) * 0.1;
        entry.mesh.position.z += (entry.targetZ - entry.mesh.position.z) * 0.1;
        entry.mesh.scale.y += (entry.targetScale - entry.mesh.scale.y) * 0.1;
        entry.mesh.material.emissive?.set(isActive ? 0x151515 : 0x000000);
      });
      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(animate);
    };
    animationFrame = requestAnimationFrame(animate);
    resize();

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerleave', handlePointerLeave);
      controls.dispose();
      scene.traverse((object) => {
        if (object.isMesh) {
          object.geometry?.dispose();
          object.material?.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      meshesRef.current = [];
    };
  }, [chartData, distributionTotal]);

  if (!chartData.length || !distributionTotal) return <div className="evaluation-empty">{emptyMessage}</div>;
  const active = hovered;

  return (
    <div className="evaluation-3d-donut-wrap" aria-label={`Open evaluation status: ${resolvedTotal} evaluations`}>
      <div className="evaluation-3d-donut-graphic">
        <div ref={mountRef} className="evaluation-3d-donut-canvas" />
        <div className="evaluation-3d-donut-center">
          <strong style={active ? { color: active.color } : undefined}>{active?.value ?? resolvedTotal}</strong>
          <span>{active?.label ?? 'Open'}</span>
        </div>
        {hovered && (
          <div className="evaluation-3d-donut-tooltip" style={{ left: hovered.x + 12, top: hovered.y + 12 }}>
            <b><i style={{ backgroundColor: hovered.color }} />{hovered.label}</b>
            <span>{hovered.value} evaluations</span>
          </div>
        )}
      </div>
      <ul className="sr-only">
        {chartData.map((item) => <li key={item.key}>{item.label}: {item.value}</li>)}
      </ul>
    </div>
  );
}
