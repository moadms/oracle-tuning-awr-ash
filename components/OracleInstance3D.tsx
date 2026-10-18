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
  ChevronRight,
  ChevronLeft,
  Sparkles,
  ArrowRight,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Zap
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
  position: [number, number, number];
}

const DETAILS_MAP: Record<string, ComponentDetail> = {
  session_client: {
    id: 'session_client',
    name: 'Session Utilisateur & PGA',
    category: 'Processus',
    role: 'Représente les applications clientes connectées (JDBC, SQL*Plus, ERP) et la mémoire privée PGA.',
    awrAshRole: 'Génère le DB Time. Lorsque la session attend une ressource, son état est capturé par ASH et cumulé dans AWR.',
    views: ['V$SESSION', 'V$PROCESS', 'V$SESSTAT'],
    tuningTip: 'Surveillez le ratio DB Time / Elapsed Time (Average Active Sessions AAS).',
    color: '#a855f7',
    position: [-10, 3, 10]
  },
  buffer_cache: {
    id: 'buffer_cache',
    name: 'Database Buffer Cache',
    category: 'Mémoire SGA',
    role: 'Conserve en mémoire vive les copies des blocs de données lus depuis les Datafiles physiques.',
    awrAshRole: 'Analysé dans AWR via "Buffer Pool Advisory" et "Instance Efficiency". Si un bloc n\'y est pas, déclenche "db file sequential read" ou "db file scattered read".',
    views: ['V$BH', 'V$BUFFER_POOL', 'V$DB_CACHE_ADVICE', 'DBA_HIST_DB_CACHE_ADVICE'],
    tuningTip: 'Ajustez DB_CACHE_SIZE si l\'Advisory AWR indique un gain substantiel de réduction des lectures physiques.',
    color: '#06b6d4',
    position: [-4.5, 2, -2.5]
  },
  shared_pool: {
    id: 'shared_pool',
    name: 'Shared Pool (Library Cache & Dict Cache)',
    category: 'Mémoire SGA',
    role: 'Stocke les plans d\'exécution SQL compilés, les triggers PL/SQL et les métadonnées du dictionnaire.',
    awrAshRole: 'Contention visible dans AWR via "latch: shared pool" et "latch: library cache" lors d\'un Hard Parsing storm. Visible dans ASH par des sessions bloquées au parse.',
    views: ['V$SQL', 'V$LIBRARYCACHE', 'V$SHARED_POOL_ADVICE', 'DBA_HIST_SQLSTAT'],
    tuningTip: 'Utilisez impérativement des Bind Variables (:id) pour mutualiser les curseurs et soulager le CPU.',
    color: '#8b5cf6',
    position: [4.5, 2, -2.5]
  },
  ash_buffer: {
    id: 'ash_buffer',
    name: 'Tampon Circulaire ASH (1s Sampling)',
    category: 'Mémoire SGA',
    role: 'Zone mémoire circulaire dans la SGA réservée à l\'Active Session History (~2 Mo par CPU).',
    awrAshRole: 'Échantillonne CHAQUE SECONDE 100% des sessions actives (WAITING ou CPU). Permet d\'analyser les micro-pics de 15 à 60 secondes sans toucher aux disques.',
    views: ['V$ACTIVE_SESSION_HISTORY', 'V$ASH_INFO'],
    tuningTip: 'Accessible directement sans aucun impact I/O. Quand le tampon est plein, les données anciennes sont transférées par MMNL vers SYSAUX.',
    color: '#ec4899',
    position: [0, 2, 2.5]
  },
  redo_buffer: {
    id: 'redo_buffer',
    name: 'Redo Log Buffer',
    category: 'Mémoire SGA',
    role: 'Tampon circulaire en mémoire enregistrant toutes les modifications (vecteurs de redo) apportées à la base.',
    awrAshRole: 'Goulot d\'étranglement visible dans AWR par "log buffer space" ou "log file sync" lors des COMMITs.',
    views: ['V$LOG', 'V$LOG_HISTORY', 'DBA_HIST_SYSSTAT'],
    tuningTip: 'Évitez les COMMIT dans des boucles PL/SQL pour ne pas saturer LGWR.',
    color: '#f97316',
    position: [0, 0.8, -5]
  },
  mmon: {
    id: 'mmon',
    name: 'Processus MMON (Manageability Monitor)',
    category: 'Processus',
    role: 'Collecte les métriques de la SGA et déclenche la capture périodique des snapshots AWR.',
    awrAshRole: 'Toutes les 60 minutes, MMON réveille un worker esclave (m000) pour écrire le Snapshot AWR dans le tablespace SYSAUX.',
    views: ['DBA_HIST_SNAPSHOT', 'DBA_HIST_WR_CONTROL', 'V$PROCESS'],
    tuningTip: 'Configurez la fréquence et la rétention avec DBMS_WORKLOAD_REPOSITORY.MODIFY_SNAPSHOT_SETTINGS.',
    color: '#10b981',
    position: [-8, 7, 3]
  },
  mmnl: {
    id: 'mmnl',
    name: 'Processus MMNL (Manageability Monitor Light)',
    category: 'Processus',
    role: 'Processus d\'arrière-plan allégé dédié au transfert régulier des données ASH vers le disque.',
    awrAshRole: 'Quand le tampon ASH est plein ou qu\'une heure s\'est écoulée, MMNL décharge 1 échantillon sur 10 dans DBA_HIST_ACTIVE_SESS_HISTORY.',
    views: ['DBA_HIST_ACTIVE_SESS_HISTORY', 'V$ACTIVE_SESSION_HISTORY'],
    tuningTip: 'Le ratio de 1/10 économise 90% d\'espace disque tout en conservant une validité statistique.',
    color: '#eab308',
    position: [-2, 7, 6]
  },
  lgwr: {
    id: 'lgwr',
    name: 'Processus LGWR (Log Writer)',
    category: 'Processus',
    role: 'Écrit les données du Redo Log Buffer de la SGA vers les fichiers Redo Logs physiques lors des COMMITs.',
    awrAshRole: 'Si LGWR est lent ou sollicité en boucle, les sessions clientes attendent sur "log file sync" dans l\'AWR et l\'ASH.',
    views: ['V$SYSTEM_EVENT', 'DBA_HIST_SYSTEM_EVENT'],
    tuningTip: 'Regroupez les commits par lots (Bulk Collect / FORALL). Placez les Redo Logs sur stockage SSD ultra-rapide.',
    color: '#f43f5e',
    position: [8, 7, 2]
  },
  sysaux: {
    id: 'sysaux',
    name: 'Tablespace SYSAUX (Référentiel AWR)',
    category: 'Stockage Disque',
    role: 'Tablespace système auxiliaire obligatoire hébergeant les tables WRH$* et les vues DBA_HIST_*.',
    awrAshRole: 'Stocke les snapshots AWR sur 8 jours et l\'historique ASH déchargé par MMNL.',
    views: ['V$SYSAUX_OCCUPANTS', 'DBA_HIST_SNAPSHOT', 'DBA_DATA_FILES'],
    tuningTip: 'Vérifiez la taille du schéma AWR avec V$SYSAUX_OCCUPANTS WHERE OCCUPANT_NAME = \'SM/AWR\'.',
    color: '#3b82f6',
    position: [0, -3.5, 7]
  },
  datafiles: {
    id: 'datafiles',
    name: 'Datafiles Physiques (Disque .dbf)',
    category: 'Stockage Disque',
    role: 'Fichiers physiques de données hébergeant les tables et les index sur le disque dur ou SAN/NAS.',
    awrAshRole: 'Les lectures disques physiques génèrent "db file sequential read" (index lookup) ou "db file scattered read" (full table scan).',
    views: ['V$DATAFILE', 'DBA_DATA_FILES', 'V$FILESTAT'],
    tuningTip: 'Utilisez des index appropriés pour éviter les lectures disques superflues.',
    color: '#0284c7',
    position: [-7, -3.5, 0]
  },
  redofiles: {
    id: 'redofiles',
    name: 'Redo Log Files (Disque .log)',
    category: 'Stockage Disque',
    role: 'Fichiers disques journalisant toutes les transactions pour garantir la durabilité (ACID).',
    awrAshRole: 'Écritures suivies via "log file parallel write" (LGWR) et "log file sync" (session utilisateur).',
    views: ['V$LOGFILE', 'V$LOG'],
    tuningTip: 'I/O critiques : toujours dédier les disques les plus rapides aux Redo Logs.',
    color: '#e11d48',
    position: [7, -3.5, -4]
  }
};

export interface FlowScenario {
  id: string;
  title: string;
  badge: string;
  description: string;
  steps: {
    stepNum: number;
    title: string;
    from: string;
    to: string;
    actionText: string;
    technicalDetails: string;
    waitEvent?: string;
  }[];
}

const FLOW_SCENARIOS: FlowScenario[] = [
  {
    id: 'query_execution',
    title: '1. Requête SQL & Cache Hit/Miss',
    badge: 'Cycle de Requête',
    description: 'Déroulement complet de l\'exécution d\'un SELECT : de la session cliente au Buffer Cache et à l\'I/O disque en cas de Cache Miss.',
    steps: [
      {
        stepNum: 1,
        title: 'Envoi du SELECT par la Session Cliente',
        from: 'session_client',
        to: 'shared_pool',
        actionText: 'La session cliente transmet le texte SQL au processus serveur dans la PGA.',
        technicalDetails: 'Vérification syntaxique et sémantique dans la Shared Pool (Library Cache). Si la requête a déjà été exécutée avec des variables liées, le plan compilé est immédiatement réutilisé (Soft Parse). Sinon, compilation complète coûteuse en CPU (Hard Parse).'
      },
      {
        stepNum: 2,
        title: 'Recherche des Blocs dans le Buffer Cache',
        from: 'shared_pool',
        to: 'buffer_cache',
        actionText: 'Le processus serveur consulte la table de hachage du Database Buffer Cache dans la SGA.',
        technicalDetails: 'Si le bloc de données recherché est déjà présent en mémoire : Cache Hit ! Lecture logique ultra-rapide (Logical Read) sans toucher au disque.'
      },
      {
        stepNum: 3,
        title: 'Cache Miss : Lecture Physique sur les Datafiles',
        from: 'buffer_cache',
        to: 'datafiles',
        actionText: 'Le bloc n\'est pas en mémoire : Oracle émet une lecture synchrone sur les fichiers physiques.',
        technicalDetails: 'La session se met en état d\'attente instrumenté ! Si c\'est un accès par index, l\'évènement est "db file sequential read" (mono-bloc). Si c\'est un Full Table Scan, c\'est "db file scattered read" (multi-blocs).',
        waitEvent: 'db file sequential / scattered read'
      },
      {
        stepNum: 4,
        title: 'Chargement en SGA & Retour des Données',
        from: 'datafiles',
        to: 'session_client',
        actionText: 'Le bloc est placé dans la liste LRU du Buffer Cache et les lignes sont retournées au client.',
        technicalDetails: 'La session sort de son état de Wait Event. Le temps total d\'attente est comptabilisé dans le DB Time de l\'AWR.'
      }
    ]
  },
  {
    id: 'ash_sampling',
    title: '2. Échantillonnage ASH Haute Fréquence (1s)',
    badge: 'Microscope Temporel',
    description: 'Comment ASH capture l\'état de chaque session active chaque seconde en mémoire vive sans ralentir la base, puis décharge vers le disque.',
    steps: [
      {
        stepNum: 1,
        title: 'Capture 1s des Sessions Actives en SGA',
        from: 'session_client',
        to: 'ash_buffer',
        actionText: 'Chaque 1 seconde, ASH photographie toutes les sessions actives (sur CPU ou en attente).',
        technicalDetails: 'ASH lit la mémoire SGA sans poser de verrous lourds (latch-free traversal). Les sessions inactives (attente client) sont ignorées. Overhead CPU inférieur à 1% !'
      },
      {
        stepNum: 2,
        title: 'Enregistrement dans le Tampon Circulaire (V$)',
        from: 'ash_buffer',
        to: 'ash_buffer',
        actionText: 'L\'échantillon est inscrit dans le tampon circulaire SGA : V$ACTIVE_SESSION_HISTORY.',
        technicalDetails: 'Le tampon alloue ~2 Mo par processeur CPU. Chaque ligne contient le SID, le SQL_ID en cours d\'exécution, le Wait Event précis, et la session bloquante éventuelle (BLOCKING_SESSION).'
      },
      {
        stepNum: 3,
        title: 'Déchargement par MMNL vers SYSAUX (1/10e)',
        from: 'ash_buffer',
        to: 'sysaux',
        actionText: 'Le processus d\'arrière-plan MMNL décharge les données vers le disque avec un ratio de 1 sur 10.',
        technicalDetails: 'Quand le tampon mémoire est plein ou toutes les heures, MMNL écrit 1 échantillon sur 10 dans la table WRH$_ACTIVE_SESSION_HISTORY (vue DBA_HIST_ACTIVE_SESS_HISTORY) dans SYSAUX pour économiser l\'espace disque.'
      }
    ]
  },
  {
    id: 'awr_snapshot',
    title: '3. Capture de Snapshot AWR par MMON (60 min)',
    badge: 'Boîte Noire Globale',
    description: 'Le mécanisme automatique horaire capturant les compteurs cumulatifs pour le calcul des différentiels du rapport AWR.',
    steps: [
      {
        stepNum: 1,
        title: 'Réveil Périodique du Processus MMON',
        from: 'mmon',
        to: 'buffer_cache',
        actionText: 'Le minuteur de 60 minutes expire : MMON (Manageability Monitor) se réveille en arrière-plan.',
        technicalDetails: 'MMON inspecte les compteurs cumulatifs de performance de toute l\'instance Oracle (nombre d\'I/O, temps CPU, exécutions SQL, évènements d\'attente système).'
      },
      {
        stepNum: 2,
        title: 'Délégation au Processus Esclave m000',
        from: 'mmon',
        to: 'mmon',
        actionText: 'MMON réveille un worker esclave (m000) pour effectuer le travail lourd d\'écriture.',
        technicalDetails: 'Cette architecture évite que le processus principal MMON ne soit bloqué pendant les opérations I/O sur disque.'
      },
      {
        stepNum: 3,
        title: 'Écriture du Snapshot dans SYSAUX',
        from: 'mmon',
        to: 'sysaux',
        actionText: 'Le worker écrit le cliché horodaté (Snapshot ID) dans les tables WRH$* de SYSAUX.',
        technicalDetails: 'Le snapshot est conservé pendant 8 jours par défaut. Lorsque le DBA exécute @?/rdbms/admin/awrrpt.sql, Oracle calcule simplement la différence (Delta) entre deux Snapshots consécutifs.'
      }
    ]
  },
  {
    id: 'commit_lgwr',
    title: '4. Validation (COMMIT) & Goulot LGWR',
    badge: 'Commit & Redo',
    description: 'Comment une simple instruction COMMIT déclenche l\'écriture physique et peut provoquer l\'évènement d\'attente log file sync.',
    steps: [
      {
        stepNum: 1,
        title: 'Exécution du COMMIT par la Session',
        from: 'session_client',
        to: 'redo_buffer',
        actionText: 'La session utilisateur exécute COMMIT : les modifications sont dans le Redo Log Buffer.',
        technicalDetails: 'Pour respecter la règle ACID de Durabilité, la transaction ne peut être considérée validée tant que les vecteurs de redo ne sont pas écrits physiquement sur les disques non volatils.'
      },
      {
        stepNum: 2,
        title: 'Attente "log file sync" & Réveil de LGWR',
        from: 'redo_buffer',
        to: 'lgwr',
        actionText: 'La session s\'endort sur l\'évènement "log file sync" et réveille d\'urgence le Log Writer (LGWR).',
        technicalDetails: 'Si l\'application fait des COMMIT dans une boucle PL/SQL (50 000 fois), LGWR est submergé et le temps d\'attente "log file sync" explose en tête du rapport AWR !',
        waitEvent: 'log file sync'
      },
      {
        stepNum: 3,
        title: 'Écriture Physique sur les Fichiers Redo Logs',
        from: 'lgwr',
        to: 'redofiles',
        actionText: 'LGWR écrit les blocs sur disque physique (log file parallel write) et réveille la session.',
        technicalDetails: 'Dès que le disque confirme l\'écriture, LGWR acquitte la fin du commit. La session sort de son attente et reçoit "Commit complete".'
      }
    ]
  }
];

export default function OracleInstance3D() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [selectedComponent, setSelectedComponent] = useState<ComponentDetail>(DETAILS_MAP.ash_buffer);
  const [isRotating, setIsRotating] = useState<boolean>(true);
  const [particlesEnabled, setParticlesEnabled] = useState<boolean>(true);
  const [activePreset, setActivePreset] = useState<string>('overview');

  // Scenario states
  const [activeScenarioIndex, setActiveScenarioIndex] = useState<number>(0);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(false);

  const activeScenario = FLOW_SCENARIOS[activeScenarioIndex];
  const activeStep = activeScenario.steps[activeStepIndex];

  // Three.js internal references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const interactiveObjectsRef = useRef<{ id: string; mesh: THREE.Object3D }[]>([]);
  const particlesRef = useRef<THREE.Points | null>(null);
  const arrowHelperRef = useRef<THREE.ArrowHelper | null>(null);
  const beaconRingsRef = useRef<THREE.Mesh[]>([]);

  // 1. AUTO-PLAY TIMER FOR SCENARIO STEPS
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isAutoPlaying) {
      timer = setInterval(() => {
        setActiveStepIndex((prev) => {
          if (prev < activeScenario.steps.length - 1) {
            sounds.playClick();
            return prev + 1;
          } else {
            // Loop back to start
            sounds.playSnapshot();
            return 0;
          }
        });
      }, 4000);
    }
    return () => clearInterval(timer);
  }, [isAutoPlaying, activeScenario]);

  // 2. THREE.JS INITIALIZATION
  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x060813);
    scene.fog = new THREE.FogExp2(0x060813, 0.022);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 16, 28);
    camera.lookAt(0, 1, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    container.replaceChildren(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
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

    // Grid Floor
    const grid = new THREE.GridHelper(40, 40, 0x1e293b, 0x0f172a);
    grid.position.y = -5;
    scene.add(grid);

    // SGA Platform (Glass Box Wireframe)
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

    // Helper to create 3D components
    const createComponentMesh = (
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

      const edges = new THREE.EdgesGeometry(geo);
      const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 });
      const line = new THREE.LineSegments(edges, lineMat);
      mesh.add(line);

      interactiveObjectsRef.current.push({ id, mesh });
      return mesh;
    };

    // 1. Session Client (Purple Octahedron outside SGA)
    createComponentMesh(
      'session_client',
      new THREE.OctahedronGeometry(1.6),
      0xa855f7,
      DETAILS_MAP.session_client.position
    );

    // 2. Buffer Cache (Cyan Box)
    createComponentMesh(
      'buffer_cache',
      new THREE.BoxGeometry(6, 2.8, 5.5),
      0x06b6d4,
      DETAILS_MAP.buffer_cache.position
    );

    // 3. Shared Pool (Purple Box)
    createComponentMesh(
      'shared_pool',
      new THREE.BoxGeometry(5.5, 2.8, 5.5),
      0x8b5cf6,
      DETAILS_MAP.shared_pool.position
    );

    // 4. ASH Circular Buffer (Pink Cylinder)
    createComponentMesh(
      'ash_buffer',
      new THREE.CylinderGeometry(2.2, 2.2, 2.2, 32),
      0xec4899,
      DETAILS_MAP.ash_buffer.position
    );

    // 5. Redo Log Buffer (Orange Bar)
    createComponentMesh(
      'redo_buffer',
      new THREE.BoxGeometry(14, 0.8, 1.6),
      0xf97316,
      DETAILS_MAP.redo_buffer.position
    );

    // 6. Background Processes (Spheres)
    const procGeo = new THREE.SphereGeometry(1.0, 32, 32);
    createComponentMesh('mmon', procGeo, 0x10b981, DETAILS_MAP.mmon.position);
    createComponentMesh('mmnl', procGeo, 0xeab308, DETAILS_MAP.mmnl.position);
    createComponentMesh('lgwr', procGeo, 0xf43f5e, DETAILS_MAP.lgwr.position);

    // 7. Disk Storage (Cylinders)
    const diskGeo = new THREE.CylinderGeometry(2.8, 2.8, 2.2, 32);
    createComponentMesh('sysaux', diskGeo, 0x3b82f6, DETAILS_MAP.sysaux.position);

    const dfGeo = new THREE.CylinderGeometry(2.4, 2.4, 2.2, 32);
    createComponentMesh('datafiles', dfGeo, 0x0284c7, DETAILS_MAP.datafiles.position, 0.7);

    const redoDiskGeo = new THREE.CylinderGeometry(2.2, 2.2, 2.2, 32);
    createComponentMesh('redofiles', redoDiskGeo, 0xe11d48, DETAILS_MAP.redofiles.position, 0.7);

    // Particles Simulation
    const particleCount = 350;
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

    // Raycaster for Clicking 3D Components
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

    // Animation Loop
    let animationId: number;
    let angle = 0;

    const animate = () => {
      animationId = requestAnimationFrame(animate);

      if (isRotating && activePreset === 'overview') {
        angle += 0.0025;
        camera.position.x = Math.sin(angle) * 26;
        camera.position.z = Math.cos(angle) * 26;
        camera.position.y = 15;
        camera.lookAt(0, 1, 0);
      }

      // Pulse MMON, MMNL, ASH Buffer
      const time = Date.now() * 0.003;
      interactiveObjectsRef.current.forEach(({ id, mesh }) => {
        if (id === 'mmon' || id === 'mmnl' || id === 'ash_buffer') {
          const scale = 1 + Math.sin(time * 3 + (id === 'mmon' ? 0 : 2)) * 0.07;
          mesh.scale.set(scale, scale, scale);
        }
      });

      // Update particles
      if (particlesEnabled && particlesRef.current) {
        const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < particleCount; i++) {
          positions[i * 3] += pVel[i * 3];
          positions[i * 3 + 1] += pVel[i * 3 + 1];
          positions[i * 3 + 2] += pVel[i * 3 + 2];

          if (positions[i * 3] > 10 || positions[i * 3] < -10) positions[i * 3] *= -0.9;
          if (positions[i * 3 + 1] > 10 || positions[i * 3 + 1] < -4) positions[i * 3 + 1] = 8;
          if (positions[i * 3 + 2] > 10 || positions[i * 3 + 2] < -10) positions[i * 3 + 2] *= -0.9;
        }
        particlesRef.current.geometry.attributes.position.needsUpdate = true;
      }

      renderer.render(scene, camera);
    };

    animate();

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

  // 3. UPDATE 3D ARROW & BEACONS WHEN SCENARIO STEP CHANGES
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;

    // Remove old arrow
    if (arrowHelperRef.current) {
      scene.remove(arrowHelperRef.current);
      arrowHelperRef.current = null;
    }

    // Remove old beacon rings
    beaconRingsRef.current.forEach(ring => scene.remove(ring));
    beaconRingsRef.current = [];

    const fromComp = DETAILS_MAP[activeStep.from];
    const toComp = DETAILS_MAP[activeStep.to];

    if (!fromComp || !toComp) return;

    const fromPos = new THREE.Vector3(...fromComp.position);
    const toPos = new THREE.Vector3(...toComp.position);

    // Create 3D Arrow Helper
    const dir = new THREE.Vector3().subVectors(toPos, fromPos);
    const length = dir.length();
    dir.normalize();

    if (length > 0.5) {
      const arrowColor = activeStep.waitEvent ? 0xf43f5e : 0x06b6d4;
      const arrow = new THREE.ArrowHelper(dir, fromPos, length - 1.2, arrowColor, 1.2, 0.8);
      scene.add(arrow);
      arrowHelperRef.current = arrow;
    }

    // Create pulsing beacon ring on target component
    const ringGeo = new THREE.RingGeometry(1.6, 2.0, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: activeStep.waitEvent ? 0xf43f5e : 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(toPos);
    ring.position.y += 2.0;
    ring.rotation.x = -Math.PI / 2;
    scene.add(ring);
    beaconRingsRef.current.push(ring);

    // Also update selected component to the destination
    setSelectedComponent(toComp);
  }, [activeStep]);

  const handleNextStep = () => {
    sounds.playClick();
    if (activeStepIndex < activeScenario.steps.length - 1) {
      setActiveStepIndex(prev => prev + 1);
    } else {
      setActiveStepIndex(0);
    }
  };

  const handlePrevStep = () => {
    sounds.playClick();
    if (activeStepIndex > 0) {
      setActiveStepIndex(prev => prev - 1);
    } else {
      setActiveStepIndex(activeScenario.steps.length - 1);
    }
  };

  const handleSelectScenario = (idx: number) => {
    sounds.playClick();
    setActiveScenarioIndex(idx);
    setActiveStepIndex(0);
  };

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Scenario Selector Ribbon */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-md shadow-2xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono font-semibold text-cyan-400 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-cyan-400" /> Scénarios Interactifs de Flux (Flèches &amp; Signes 3D)
          </span>
          <h3 className="text-base font-bold text-white">
            {activeScenario.title}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {FLOW_SCENARIOS.map((sc, idx) => {
            const isCurrent = idx === activeScenarioIndex;
            return (
              <button
                key={sc.id}
                onClick={() => handleSelectScenario(idx)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  isCurrent
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20 ring-2 ring-cyan-400/40'
                    : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-750'
                }`}
              >
                <span>{sc.badge}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main 3D Canvas + Flow Controller Card */}
      <div className="relative w-full h-[640px] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950/80 backdrop-blur-md shadow-2xl flex flex-col lg:flex-row">
        {/* 3D Viewport */}
        <div className="relative flex-1 h-[380px] lg:h-full cursor-grab active:cursor-grabbing" ref={mountRef}>
          {/* Top Overlays: Rotation & Particles Toggle */}
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
              {isRotating ? 'Rotation ON' : 'Rotation Pause'}
            </button>

            <button
              onClick={() => {
                setIsAutoPlaying(!isAutoPlaying);
                sounds.playClick();
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all shadow-lg ${
                isAutoPlaying
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 animate-pulse'
                  : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'
              }`}
            >
              {isAutoPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
              {isAutoPlaying ? 'Auto-Défilement Étape' : 'Lecture Auto'}
            </button>
          </div>

          {/* Floating On-Screen 3D Step Sign (Flèche & Direction) */}
          <div className="absolute top-4 right-4 z-10 max-w-xs bg-slate-900/90 backdrop-blur p-3 rounded-xl border border-cyan-500/40 shadow-2xl flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-cyan-400 font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> FLÈCHE 3D ACTIVE
              </span>
              <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 text-[10px] border border-cyan-800">
                Étape {activeStep.stepNum} / {activeScenario.steps.length}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold text-white pt-1">
              <span className="text-cyan-300 font-mono text-[11px] truncate max-w-[90px]">
                {DETAILS_MAP[activeStep.from]?.name}
              </span>
              <ArrowRight className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-pink-300 font-mono text-[11px] truncate max-w-[90px]">
                {DETAILS_MAP[activeStep.to]?.name}
              </span>
            </div>

            {activeStep.waitEvent && (
              <div className="mt-1 p-1.5 rounded bg-rose-950/60 border border-rose-800/60 text-[10px] text-rose-300 flex items-center gap-1 font-mono">
                <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                <span>Wait Event: {activeStep.waitEvent}</span>
              </div>
            )}
          </div>

          {/* Bottom Interactive Step Controller Bar */}
          <div className="absolute bottom-4 left-4 right-4 z-10 flex items-center justify-between gap-3 bg-slate-900/95 backdrop-blur-md p-2.5 rounded-2xl border border-slate-800 shadow-2xl">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevStep}
                className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
                title="Étape précédente"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleNextStep}
                className="p-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold hover:brightness-110 shadow-lg shadow-cyan-500/25 transition flex items-center gap-1"
                title="Étape suivante"
              >
                <span className="text-xs hidden sm:inline">Étape Suivante</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto py-1">
              {activeScenario.steps.map((st, i) => (
                <button
                  key={st.stepNum}
                  onClick={() => {
                    sounds.playClick();
                    setActiveStepIndex(i);
                  }}
                  className={`w-7 h-7 rounded-lg text-xs font-mono font-bold transition flex items-center justify-center shrink-0 ${
                    i === activeStepIndex
                      ? 'bg-cyan-500 text-slate-950 shadow-md ring-2 ring-cyan-400/50'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {st.stepNum}
                </button>
              ))}
            </div>

            <span className="text-xs text-slate-300 font-semibold truncate hidden md:inline">
              {activeStep.title}
            </span>
          </div>
        </div>

        {/* Right Column: Detailed Flow Explanation & Architecture Inspector (380px) */}
        <div className="w-full lg:w-[400px] p-5 bg-slate-900/95 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col justify-between overflow-y-auto">
          <div>
            {/* Step Action Box */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-950/40 via-slate-900 to-blue-950/40 border border-cyan-800/50 shadow-inner">
              <div className="flex items-center justify-between pb-2 border-b border-cyan-900/40">
                <span className="text-xs font-mono font-bold text-cyan-300 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" /> Étape {activeStep.stepNum} : Ce qui se passe
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-900/60 text-cyan-200">
                  Temps Réel
                </span>
              </div>

              <h4 className="text-sm font-bold text-white mt-2 leading-snug">
                {activeStep.title}
              </h4>
              <p className="text-xs text-cyan-200/90 mt-1.5 leading-relaxed font-sans">
                {activeStep.actionText}
              </p>

              <div className="mt-3 p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] text-slate-300 leading-relaxed font-sans">
                <strong className="text-amber-400 block mb-0.5 font-mono">Détail Technique Oracle :</strong>
                {activeStep.technicalDetails}
              </div>
            </div>

            {/* Currently Focused Component Inspector */}
            <div className="mt-5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-purple-400" /> Cible 3D : {selectedComponent.name}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                  {selectedComponent.category}
                </span>
              </div>

              <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                {selectedComponent.role}
              </p>

              <div className="mt-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-[11px] font-semibold text-pink-400 flex items-center gap-1.5 mb-1">
                  <Activity className="w-3.5 h-3.5" /> Rôle dans AWR &amp; ASH
                </span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {selectedComponent.awrAshRole}
                </p>
              </div>

              <div className="mt-3">
                <span className="text-[11px] font-semibold text-slate-400 mb-1.5 flex items-center gap-1">
                  <Database className="w-3 h-3 text-cyan-400" /> Vues Oracle Clés :
                </span>
                <div className="flex flex-wrap gap-1">
                  {selectedComponent.views.map((v) => (
                    <span
                      key={v}
                      className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-cyan-300 border border-slate-700"
                    >
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
            <span>Cliquez sur une flèche ou un bloc 3D</span>
            <span className="font-mono text-cyan-400">Oracle 19c/21c</span>
          </div>
        </div>
      </div>
    </div>
  );
}
