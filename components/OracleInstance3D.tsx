'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { 
  Database, 
  Cpu, 
  HardDrive, 
  Layers, 
  Activity, 
  RotateCw, 
  Info, 
  Play, 
  Pause,
  ZoomIn,
  Eye
} from 'lucide-react';
import { sounds } from '@/lib/sounds';

interface ComponentDetail {
  id: string;
  name: string;
  category: 'Mémoire SGA' | 'Processus' | 'Stockage Disque';
  role: string;
  awrAshRole: string;
  views: string[];
  tuningTip: string;
  color: string;
}

const DETAILS_MAP: Record<string, ComponentDetail> = {
  buffer_cache: {
    id: 'buffer_cache',
    name: 'Database Buffer Cache',
    category: 'Mémoire SGA',
    role: 'Conserve en mémoire vive les copies des blocs de données lus depuis les Datafiles physiques.',
    awrAshRole: 'Analysé dans AWR via les sections "Buffer Pool Advisory" et "Instance Efficiency (Buffer Hit %)". Dans ASH, les requêtes lentes attendent "db file sequential read" ou "db file scattered read" quand les blocs ne sont pas en cache.',
    views: ['V$BH', 'V$BUFFER_POOL', 'V$DB_CACHE_ADVICE', 'DBA_HIST_DB_CACHE_ADVICE'],
    tuningTip: 'Ajustez DB_CACHE_SIZE si l\'Advisory AWR indique un gain substantiel de réduction des lectures disques physiques.',
    color: '#06b6d4'
  },
  shared_pool: {
    id: 'shared_pool',
    name: 'Shared Pool (Library Cache & Dict Cache)',
    category: 'Mémoire SGA',
    role: 'Stocke les plans d\'exécution SQL compilés, les triggers PL/SQL et les métadonnées du dictionnaire de données.',
    awrAshRole: 'Contention visible dans AWR via "latch: shared pool" et "latch: library cache" si Hard Parsing storm. Visible dans ASH par de nombreuses sessions bloquées au parse.',
    views: ['V$SQL', 'V$LIBRARYCACHE', 'V$SHARED_POOL_ADVICE', 'DBA_HIST_SQLSTAT'],
    tuningTip: 'Utilisez des Bind Variables pour mutualiser les curseurs et éviter que chaque constante ne déclenche un re-parsing.',
    color: '#8b5cf6'
  },
  ash_buffer: {
    id: 'ash_buffer',
    name: 'ASH Circular Buffer (V$ACTIVE_SESSION_HISTORY)',
    category: 'Mémoire SGA',
    role: 'Zone mémoire circulaire dans la SGA réservée à l\'Active Session History. Alloue environ 2 Mo par CPU.',
    awrAshRole: 'Échantillonne CHAQUE SECONDE 100% des sessions actives (WAITING ou CPU). Permet d\'analyser les micro-pics de 15 à 60 secondes sans toucher aux disques.',
    views: ['V$ACTIVE_SESSION_HISTORY', 'V$ASH_INFO'],
    tuningTip: 'Accessible directement sans aucun impact I/O. Quand le tampon est plein, les données anciennes sont écrasées ou transférées par MMNL.',
    color: '#ec4899'
  },
  redo_buffer: {
    id: 'redo_buffer',
    name: 'Redo Log Buffer',
    category: 'Mémoire SGA',
    role: 'Tampon circulaire en mémoire enregistrant toutes les modifications (vecteurs de redo) apportées à la base.',
    awrAshRole: 'Un goulot d\'étranglement ici se traduit dans AWR par l\'évènement d\'attente "log buffer space" ou "log file switch".',
    views: ['V$LOG', 'V$LOG_HISTORY', 'DBA_HIST_SYSSTAT'],
    tuningTip: 'Alloué via LOG_BUFFER. Doit être suffisamment grand pour absorber les pics d\'écriture avant que LGWR ne vide vers le disque.',
    color: '#f97316'
  },
  mmon: {
    id: 'mmon',
    name: 'Processus MMON (Manageability Monitor)',
    category: 'Processus',
    role: 'Processus d\'arrière-plan Oracle chargé de collecter les statistiques de performance de la SGA et de déclencher les alertes proactives.',
    awrAshRole: 'Cœur moteur d\'AWR ! Toutes les 60 minutes (par défaut), MMON réveille un processus esclave (m000) pour écrire le Snapshot AWR dans le tablespace SYSAUX.',
    views: ['DBA_HIST_SNAPSHOT', 'DBA_HIST_WR_CONTROL', 'V$PROCESS'],
    tuningTip: 'Configurez la fréquence et la rétention des snapshots avec DBMS_WORKLOAD_REPOSITORY.MODIFY_SNAPSHOT_SETTINGS.',
    color: '#10b981'
  },
  mmnl: {
    id: 'mmnl',
    name: 'Processus MMNL (Manageability Monitor Light)',
    category: 'Processus',
    role: 'Processus d\'arrière-plan allégé dédié au transfert régulier des données d\'historique des sessions.',
    awrAshRole: 'Cœur moteur de la persistance ASH ! Quand le tampon ASH mémoire est plein ou qu\'une heure s\'est écoulée, MMNL décharge 1 échantillon sur 10 dans DBA_HIST_ACTIVE_SESS_HISTORY.',
    views: ['DBA_HIST_ACTIVE_SESS_HISTORY', 'V$ACTIVE_SESSION_HISTORY'],
    tuningTip: 'Le sous-échantillonnage 1 sur 10 appliqué par MMNL économise 90% d\'espace disque tout en préservant une validité statistique pour les études sur plusieurs jours.',
    color: '#eab308'
  },
  lgwr: {
    id: 'lgwr',
    name: 'Processus LGWR (Log Writer)',
    category: 'Processus',
    role: 'Écrit les données du Redo Log Buffer de la SGA vers les fichiers Redo Logs physiques sur disque lors des COMMITs.',
    awrAshRole: 'Si LGWR est lent ou si l\'application committe en boucle, les sessions clientes attendent en masse sur "log file sync" dans l\'AWR et l\'ASH.',
    views: ['V$SYSTEM_EVENT', 'DBA_HIST_SYSTEM_EVENT'],
    tuningTip: 'Évitez les COMMIT dans des boucles PL/SQL. Placez les fichiers Redo Logs sur des disques SSD/NVMe ultra-rapides.',
    color: '#f43f5e'
  },
  sysaux: {
    id: 'sysaux',
    name: 'Tablespace SYSAUX (Référentiel AWR & ASH)',
    category: 'Stockage Disque',
    role: 'Tablespace système auxiliaire obligatoire hébergeant les métadonnées de diagnostic, Enterprise Manager, et le référentiel AWR/ASH.',
    awrAshRole: 'Toutes les tables WRH$* (AWR) et WRH$_ACTIVE_SESSION_HISTORY sont stockées dans SYSAUX. Elles sont exposées aux DBA via les vues DBA_HIST_*.',
    views: ['V$SYSAUX_OCCUPANTS', 'DBA_HIST_SNAPSHOT', 'DBA_DATA_FILES'],
    tuningTip: 'Vérifiez la taille du schéma AWR dans SYSAUX avec V$SYSAUX_OCCUPANTS WHERE OCCUPANT_NAME = \'SM/AWR\'. Purgez les vieux snapshots si besoin.',
    color: '#3b82f6'
  }
};

export default function OracleInstance3D() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [selectedComponent, setSelectedComponent] = useState<ComponentDetail>(DETAILS_MAP.ash_buffer);
  const [isRotating, setIsRotating] = useState<boolean>(true);
  const [particlesEnabled, setParticlesEnabled] = useState<boolean>(true);
  const [activePreset, setActivePreset] = useState<string>('overview');

  // Three.js internal references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const interactiveObjectsRef = useRef<{ id: string; mesh: THREE.Object3D }[]>([]);
  const particlesRef = useRef<THREE.Points | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. SCENE
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x060813);
    scene.fog = new THREE.FogExp2(0x060813, 0.025);

    // 2. CAMERA
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 16, 28);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // 3. RENDERER
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    container.replaceChildren(renderer.domElement);

    // 4. LIGHTS
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x38bdf8, 2.5);
    dirLight.position.set(15, 25, 20);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const magentaLight = new THREE.PointLight(0xec4899, 3, 30);
    magentaLight.position.set(0, 5, 0);
    scene.add(magentaLight);

    const cyanLight = new THREE.PointLight(0x06b6d4, 3, 35);
    cyanLight.position.set(-8, 3, -6);
    scene.add(cyanLight);

    // 5. GRID BASE
    const grid = new THREE.GridHelper(40, 40, 0x1e293b, 0x0f172a);
    grid.position.y = -5;
    scene.add(grid);

    // 6. SGA MEMORY PLATFORM (Translucent container)
    const sgaGeo = new THREE.BoxGeometry(18, 4, 14);
    const sgaEdges = new THREE.EdgesGeometry(sgaGeo);
    const sgaLineMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.5 });
    const sgaWireframe = new THREE.LineSegments(sgaEdges, sgaLineMat);
    sgaWireframe.position.y = 2;
    scene.add(sgaWireframe);

    const sgaBoxMat = new THREE.MeshPhysicalMaterial({
      color: 0x0369a1,
      transparent: true,
      opacity: 0.12,
      roughness: 0.2,
      transmission: 0.6,
      thickness: 1.2
    });
    const sgaBox = new THREE.Mesh(sgaGeo, sgaBoxMat);
    sgaBox.position.y = 2;
    scene.add(sgaBox);

    interactiveObjectsRef.current = [];

    // Helper to create glowing components
    const createInteractiveBlock = (
      id: string,
      geo: THREE.BufferGeometry,
      color: number,
      pos: [number, number, number],
      opacity = 0.85
    ) => {
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.3,
        metalness: 0.4,
        emissive: color,
        emissiveIntensity: 0.25,
        transparent: opacity < 1,
        opacity
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...pos);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      // Edges for cyber aesthetic
      const edges = new THREE.EdgesGeometry(geo);
      const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 });
      const line = new THREE.LineSegments(edges, lineMat);
      mesh.add(line);

      interactiveObjectsRef.current.push({ id, mesh });
      return mesh;
    };

    // A. Buffer Cache (Large Cyan Block)
    createInteractiveBlock(
      'buffer_cache',
      new THREE.BoxGeometry(6, 2.8, 5.5),
      0x06b6d4,
      [-4.5, 2, -2.5]
    );

    // B. Shared Pool (Purple Block)
    createInteractiveBlock(
      'shared_pool',
      new THREE.BoxGeometry(5.5, 2.8, 5.5),
      0x8b5cf6,
      [4.5, 2, -2.5]
    );

    // C. ASH Circular Buffer (Pink/Magenta Torus or Cylindrical block in SGA)
    createInteractiveBlock(
      'ash_buffer',
      new THREE.CylinderGeometry(2.2, 2.2, 2.2, 32),
      0xec4899,
      [0, 2, 2.5]
    );

    // D. Redo Log Buffer (Orange Slim Bar)
    createInteractiveBlock(
      'redo_buffer',
      new THREE.BoxGeometry(14, 0.8, 1.6),
      0xf97316,
      [0, 0.8, -5]
    );

    // E. Background Process Spheres: MMON (Emerald) & MMNL (Yellow) & LGWR (Rose)
    const procGeo = new THREE.SphereGeometry(1.0, 32, 32);

    createInteractiveBlock('mmon', procGeo, 0x10b981, [-8, 7, 3]);
    createInteractiveBlock('mmnl', procGeo, 0xeab308, [-2, 7, 6]);
    createInteractiveBlock('lgwr', procGeo, 0xf43f5e, [8, 7, 2]);

    // F. Physical Storage Base: SYSAUX & Datafiles (Cylinders at the bottom)
    const diskGeo = new THREE.CylinderGeometry(2.8, 2.8, 2.2, 32);
    createInteractiveBlock('sysaux', diskGeo, 0x3b82f6, [0, -3.5, 7]);

    // Datafiles
    const dfGeo = new THREE.CylinderGeometry(2.4, 2.4, 2.2, 32);
    createInteractiveBlock('buffer_cache', dfGeo, 0x0284c7, [-7, -3.5, 0], 0.7);

    // Redo Logs Disk
    const redoDiskGeo = new THREE.CylinderGeometry(2.2, 2.2, 2.2, 32);
    createInteractiveBlock('redo_buffer', redoDiskGeo, 0xe11d48, [7, -3.5, -4], 0.7);

    // 7. PARTICLES: FLOW SIMULATION (Sessions -> SGA -> MMON/MMNL -> SYSAUX)
    const particleCount = 400;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(particleCount * 3);
    const pVel = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      pPos[i * 3] = (Math.random() - 0.5) * 16;
      pPos[i * 3 + 1] = Math.random() * 10 - 2;
      pPos[i * 3 + 2] = (Math.random() - 0.5) * 16;

      pVel[i * 3] = (Math.random() - 0.5) * 0.04;
      pVel[i * 3 + 1] = (Math.random() - 0.5) * 0.04;
      pVel[i * 3 + 2] = (Math.random() - 0.5) * 0.04;
    }

    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.18,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);
    particlesRef.current = particles;

    // 8. INTERACTION: RAYCASTER
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const meshesToTest = interactiveObjectsRef.current.map(o => o.mesh);
      const intersects = raycaster.intersectObjects(meshesToTest, false);

      if (intersects.length > 0) {
        const hit = intersects[0].object;
        const found = interactiveObjectsRef.current.find(o => o.mesh === hit);
        if (found && DETAILS_MAP[found.id]) {
          setSelectedComponent(DETAILS_MAP[found.id]);
          sounds.playClick();
        }
      }
    };

    container.addEventListener('pointerdown', handlePointerDown);

    // 9. ANIMATION LOOP
    let animationId: number;
    let angle = 0;

    const animate = () => {
      animationId = requestAnimationFrame(animate);

      // Rotation around center
      if (isRotating) {
        angle += 0.003;
        if (activePreset === 'overview') {
          camera.position.x = Math.sin(angle) * 26;
          camera.position.z = Math.cos(angle) * 26;
          camera.position.y = 15;
          camera.lookAt(0, 1, 0);
        }
      }

      // Pulsing effect on MMON and MMNL
      const time = Date.now() * 0.003;
      interactiveObjectsRef.current.forEach(({ id, mesh }) => {
        if (id === 'mmon' || id === 'mmnl' || id === 'ash_buffer') {
          const scale = 1 + Math.sin(time * 3 + (id === 'mmon' ? 0 : 2)) * 0.06;
          mesh.scale.set(scale, scale, scale);
        }
      });

      // Animate particles
      if (particlesEnabled && particlesRef.current) {
        const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < particleCount; i++) {
          positions[i * 3] += pVel[i * 3];
          positions[i * 3 + 1] += pVel[i * 3 + 1];
          positions[i * 3 + 2] += pVel[i * 3 + 2];

          // Wrap bounds
          if (positions[i * 3] > 10 || positions[i * 3] < -10) positions[i * 3] *= -0.9;
          if (positions[i * 3 + 1] > 10 || positions[i * 3 + 1] < -4) positions[i * 3 + 1] = 8;
          if (positions[i * 3 + 2] > 10 || positions[i * 3 + 2] < -10) positions[i * 3 + 2] *= -0.9;
        }
        particlesRef.current.geometry.attributes.position.needsUpdate = true;
      }

      renderer.render(scene, camera);
    };

    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      container.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, [isRotating, particlesEnabled, activePreset]);

  // Camera preset handler
  const setCameraPreset = (preset: string) => {
    setActivePreset(preset);
    sounds.playClick();
    if (!cameraRef.current) return;

    if (preset === 'overview') {
      cameraRef.current.position.set(0, 16, 28);
      cameraRef.current.lookAt(0, 1, 0);
    } else if (preset === 'ash') {
      cameraRef.current.position.set(0, 8, 10);
      cameraRef.current.lookAt(0, 2, 2.5);
      setSelectedComponent(DETAILS_MAP.ash_buffer);
    } else if (preset === 'mmon') {
      cameraRef.current.position.set(-10, 12, 10);
      cameraRef.current.lookAt(-5, 6, 4);
      setSelectedComponent(DETAILS_MAP.mmon);
    } else if (preset === 'sysaux') {
      cameraRef.current.position.set(0, -1, 16);
      cameraRef.current.lookAt(0, -3, 6);
      setSelectedComponent(DETAILS_MAP.sysaux);
    }
  };

  return (
    <div className="relative w-full h-[620px] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950/80 backdrop-blur-md shadow-2xl flex flex-col md:flex-row">
      {/* 3D Canvas Container */}
      <div className="relative flex-1 h-[380px] md:h-full cursor-grab active:cursor-grabbing" ref={mountRef}>
        {/* Floating Controls Overlay */}
        <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-2">
          <button
            onClick={() => {
              setIsRotating(!isRotating);
              sounds.playClick();
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all shadow-lg ${
              isRotating
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30'
                : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'
            }`}
          >
            {isRotating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {isRotating ? 'Rotation Active' : 'Rotation Pause'}
          </button>

          <button
            onClick={() => {
              setParticlesEnabled(!particlesEnabled);
              sounds.playClick();
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all shadow-lg ${
              particlesEnabled
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500/30'
                : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Flux Sessions {particlesEnabled ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Camera Views Quick Switch */}
        <div className="absolute bottom-4 left-4 z-10 flex flex-wrap gap-1.5 bg-slate-900/90 backdrop-blur p-1.5 rounded-xl border border-slate-800 shadow-xl">
          <span className="text-[11px] text-slate-400 self-center px-2 font-mono flex items-center gap-1">
            <Eye className="w-3 h-3 text-cyan-400" /> Vues :
          </span>
          <button
            onClick={() => setCameraPreset('overview')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              activePreset === 'overview'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-md'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            Vue Globale
          </button>
          <button
            onClick={() => setCameraPreset('ash')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              activePreset === 'ash'
                ? 'bg-pink-500 text-white font-semibold shadow-md'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            Tampon ASH (SGA)
          </button>
          <button
            onClick={() => setCameraPreset('mmon')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              activePreset === 'mmon'
                ? 'bg-emerald-500 text-slate-950 font-semibold shadow-md'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            MMON & MMNL
          </button>
          <button
            onClick={() => setCameraPreset('sysaux')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              activePreset === 'sysaux'
                ? 'bg-blue-500 text-white font-semibold shadow-md'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            SYSAUX (AWR)
          </button>
        </div>

        {/* 3D Visual Legend Overlay */}
        <div className="absolute top-4 right-4 z-10 hidden sm:flex flex-col gap-1.5 bg-slate-900/80 backdrop-blur p-2.5 rounded-xl border border-slate-800 text-[11px]">
          <div className="font-semibold text-slate-300 pb-1 border-b border-slate-800 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cyan-400" /> Couches 3D
          </div>
          <div className="flex items-center gap-2 text-cyan-300">
            <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500 inline-block"></span> Buffer Cache
          </div>
          <div className="flex items-center gap-2 text-purple-300">
            <span className="w-2.5 h-2.5 rounded-sm bg-purple-500 inline-block"></span> Shared Pool
          </div>
          <div className="flex items-center gap-2 text-pink-300">
            <span className="w-2.5 h-2.5 rounded-sm bg-pink-500 inline-block"></span> Tampon ASH (1s)
          </div>
          <div className="flex items-center gap-2 text-emerald-300">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Processus MMON
          </div>
          <div className="flex items-center gap-2 text-amber-300">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> Processus MMNL
          </div>
          <div className="flex items-center gap-2 text-blue-300">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block"></span> Tablespace SYSAUX
          </div>
        </div>
      </div>

      {/* Component Dossier Inspector Panel */}
      <div className="w-full md:w-[380px] p-5 bg-slate-900/95 border-t md:border-t-0 md:border-l border-slate-800 flex flex-col justify-between overflow-y-auto">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <span className="text-xs uppercase tracking-wider font-semibold text-cyan-400 flex items-center gap-1.5">
              <Info className="w-4 h-4" /> Inspecteur d&apos;Architecture
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-slate-800 text-slate-300">
              {selectedComponent.category}
            </span>
          </div>

          <div className="mt-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedComponent.color }} />
              {selectedComponent.name}
            </h3>
            <p className="mt-2 text-xs text-slate-300 leading-relaxed">
              {selectedComponent.role}
            </p>
          </div>

          <div className="mt-4 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <h4 className="text-xs font-semibold text-pink-400 flex items-center gap-1.5 mb-1.5">
              <Activity className="w-3.5 h-3.5" /> Impact AWR & ASH
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              {selectedComponent.awrAshRole}
            </p>
          </div>

          <div className="mt-4">
            <h4 className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-cyan-400" /> Vues Oracle Associées
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {selectedComponent.views.map((v) => (
                <span
                  key={v}
                  className="px-2 py-1 rounded-md text-[11px] font-mono bg-slate-800 text-cyan-300 border border-slate-700 hover:border-cyan-500/50 cursor-copy"
                  title="Cliquer pour copier le nom de la vue"
                  onClick={() => {
                    navigator.clipboard.writeText(v);
                    sounds.playClick();
                  }}
                >
                  {v}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-4 p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/40">
            <h4 className="text-xs font-semibold text-cyan-300 flex items-center gap-1.5 mb-1">
              <Cpu className="w-3.5 h-3.5" /> Règle d&apos;Optimisation DBA
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed italic">
              « {selectedComponent.tuningTip} »
            </p>
          </div>
        </div>

        <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
          <span>Cliquez sur un bloc 3D pour l&apos;inspecter</span>
          <span className="font-mono text-cyan-400">Oracle 19c / 21c</span>
        </div>
      </div>
    </div>
  );
}
