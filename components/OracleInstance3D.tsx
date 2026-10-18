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
  Zap,
  Grid,
  FileText,
  Workflow
} from 'lucide-react';
import { sounds } from '@/lib/sounds';

export interface ComponentDetail {
  id: string;
  name: string;
  tag: string;
  category: 'Mémoire SGA' | 'Processus' | 'Stockage Disque';
  role: string;
  awrAshRole: string;
  views: string[];
  tuningTip: string;
  color: string;
  position: [number, number, number];
}

export const DETAILS_MAP: Record<string, ComponentDetail> = {
  session_client: {
    id: 'session_client',
    name: 'Session Utilisateur & PGA',
    tag: 'Clients & Processus Serveur',
    category: 'Processus',
    role: 'Applications connectées (JDBC, ERP, SQL*Plus) et mémoire privée dédiée PGA (tris, hash joins).',
    awrAshRole: 'Origine du DB Time ! Lorsqu\'une session attend une ressource, son état est capturé par ASH chaque seconde et agrégé par AWR.',
    views: ['V$SESSION', 'V$PROCESS', 'V$SESSTAT'],
    tuningTip: 'Surveillez le ratio DB Time / Elapsed Time (Average Active Sessions AAS). Si AAS > nb CPUs, surcharge !',
    color: '#a855f7',
    position: [-11, 3, 10]
  },
  buffer_cache: {
    id: 'buffer_cache',
    name: 'Database Buffer Cache',
    tag: 'Cache des Blocs de Données',
    category: 'Mémoire SGA',
    role: 'Conserve en mémoire vive les copies des blocs de données (8 Ko) lus depuis les Datafiles physiques.',
    awrAshRole: 'Analysé dans AWR via "Buffer Pool Advisory" et "Instance Efficiency". Si un bloc n\'y est pas, déclenche "db file sequential read" ou "db file scattered read".',
    views: ['V$BH', 'V$BUFFER_POOL', 'V$DB_CACHE_ADVICE', 'DBA_HIST_DB_CACHE_ADVICE'],
    tuningTip: 'Ajustez DB_CACHE_SIZE si l\'Advisory AWR indique un gain substantiel de réduction des lectures physiques.',
    color: '#06b6d4',
    position: [-4.5, 2, -2.5]
  },
  shared_pool: {
    id: 'shared_pool',
    name: 'Shared Pool',
    tag: 'Library Cache & Dictionnaire',
    category: 'Mémoire SGA',
    role: 'Stocke les plans d\'exécution SQL compilés, les curseurs partagés et les métadonnées du dictionnaire de données.',
    awrAshRole: 'Contention visible dans AWR via "latch: shared pool" et "latch: library cache" lors d\'un Hard Parsing storm. Visible dans ASH par des sessions bloquées au parse.',
    views: ['V$SQL', 'V$LIBRARYCACHE', 'V$SHARED_POOL_ADVICE', 'DBA_HIST_SQLSTAT'],
    tuningTip: 'Utilisez impérativement des Bind Variables (:id) pour mutualiser les curseurs et soulager le CPU.',
    color: '#8b5cf6',
    position: [4.5, 2, -2.5]
  },
  ash_buffer: {
    id: 'ash_buffer',
    name: 'Tampon Circulaire ASH',
    tag: 'Échantillonnage 1s en Mémoire',
    category: 'Mémoire SGA',
    role: 'Zone mémoire circulaire dans la SGA réservée à l\'Active Session History (~2 Mo par processeur CPU).',
    awrAshRole: 'Échantillonne CHAQUE SECONDE 100% des sessions actives (WAITING ou CPU). Permet d\'analyser les micro-pics de 15 à 60 secondes sans toucher aux disques.',
    views: ['V$ACTIVE_SESSION_HISTORY', 'V$ASH_INFO'],
    tuningTip: 'Accessible directement sans aucun impact I/O. Quand le tampon est plein, les données anciennes sont transférées par MMNL vers SYSAUX.',
    color: '#ec4899',
    position: [0, 2, 2.5]
  },
  redo_buffer: {
    id: 'redo_buffer',
    name: 'Redo Log Buffer',
    tag: 'Journalisation des Transactions',
    category: 'Mémoire SGA',
    role: 'Tampon circulaire en mémoire enregistrant toutes les modifications (vecteurs de redo) apportées à la base.',
    awrAshRole: 'Goulot d\'étranglement visible dans AWR par "log buffer space" ou "log file sync" lors des COMMITs.',
    views: ['V$LOG', 'V$LOG_HISTORY', 'DBA_HIST_SYSSTAT'],
    tuningTip: 'Évitez les COMMIT dans des boucles PL/SQL pour ne pas saturer le processus LGWR.',
    color: '#f97316',
    position: [0, 0.8, -5.5]
  },
  mmon: {
    id: 'mmon',
    name: 'Processus MMON',
    tag: 'Générateur AWR (60 min)',
    category: 'Processus',
    role: 'Processus d\'arrière-plan Oracle chargé de collecter les statistiques de la SGA et de déclencher les clichés AWR.',
    awrAshRole: 'Toutes les 60 minutes, MMON réveille un worker esclave (m000) pour écrire le Snapshot AWR dans le tablespace SYSAUX.',
    views: ['DBA_HIST_SNAPSHOT', 'DBA_HIST_WR_CONTROL', 'V$PROCESS'],
    tuningTip: 'Configurez la fréquence et la rétention avec DBMS_WORKLOAD_REPOSITORY.MODIFY_SNAPSHOT_SETTINGS.',
    color: '#10b981',
    position: [-8, 7.5, 3]
  },
  mmnl: {
    id: 'mmnl',
    name: 'Processus MMNL',
    tag: 'Vidage ASH vers SYSAUX (1/10e)',
    category: 'Processus',
    role: 'Processus d\'arrière-plan allégé dédié au transfert régulier des données d\'historique des sessions actives vers le disque.',
    awrAshRole: 'Quand le tampon ASH est plein ou après 1h, MMNL décharge 1 échantillon sur 10 dans DBA_HIST_ACTIVE_SESS_HISTORY.',
    views: ['DBA_HIST_ACTIVE_SESS_HISTORY', 'V$ACTIVE_SESSION_HISTORY'],
    tuningTip: 'Le ratio de 1/10 économise 90% d\'espace disque tout en conservant une validité statistique.',
    color: '#eab308',
    position: [-2, 7.5, 6]
  },
  lgwr: {
    id: 'lgwr',
    name: 'Processus LGWR',
    tag: 'Log Writer (COMMIT)',
    category: 'Processus',
    role: 'Écrit les données du Redo Log Buffer de la SGA vers les fichiers Redo Logs physiques lors des COMMITs.',
    awrAshRole: 'Si LGWR est lent ou sollicité en boucle, les sessions clientes attendent sur "log file sync" dans l\'AWR et l\'ASH.',
    views: ['V$SYSTEM_EVENT', 'DBA_HIST_SYSTEM_EVENT'],
    tuningTip: 'Regroupez les commits par lots (Bulk Collect / FORALL). Placez les Redo Logs sur stockage SSD ultra-rapide.',
    color: '#f43f5e',
    position: [8, 7.5, 2]
  },
  sysaux: {
    id: 'sysaux',
    name: 'Tablespace SYSAUX',
    tag: 'Référentiel Disque AWR & ASH',
    category: 'Stockage Disque',
    role: 'Tablespace système auxiliaire obligatoire hébergeant les tables WRH$* et les vues DBA_HIST_*.',
    awrAshRole: 'Stocke les snapshots AWR sur 8 jours et l\'historique ASH déchargé par MMNL.',
    views: ['V$SYSAUX_OCCUPANTS', 'DBA_HIST_SNAPSHOT', 'DBA_DATA_FILES'],
    tuningTip: 'Vérifiez la taille du schéma AWR avec V$SYSAUX_OCCUPANTS WHERE OCCUPANT_NAME = \'SM/AWR\'.',
    color: '#3b82f6',
    position: [0, -4, 7]
  },
  datafiles: {
    id: 'datafiles',
    name: 'Datafiles (.dbf)',
    tag: 'Fichiers Physiques de Données',
    category: 'Stockage Disque',
    role: 'Fichiers physiques de données hébergeant les tables et les index sur le disque dur ou SAN/NAS.',
    awrAshRole: 'Les lectures physiques génèrent "db file sequential read" (index lookup) ou "db file scattered read" (full table scan).',
    views: ['V$DATAFILE', 'DBA_DATA_FILES', 'V$FILESTAT'],
    tuningTip: 'Utilisez des index appropriés pour éviter les lectures disques superflues.',
    color: '#0284c7',
    position: [-7.5, -4, 0]
  },
  redofiles: {
    id: 'redofiles',
    name: 'Redo Log Files (.log)',
    tag: 'Fichiers Journal de Redo',
    category: 'Stockage Disque',
    role: 'Fichiers disques journalisant toutes les transactions pour garantir la durabilité (ACID).',
    awrAshRole: 'Écritures suivies via "log file parallel write" (LGWR) et "log file sync" (session utilisateur).',
    views: ['V$LOGFILE', 'V$LOG'],
    tuningTip: 'I/O critiques : toujours dédier les disques les plus rapides aux Redo Logs.',
    color: '#e11d48',
    position: [7.5, -4, -3.5]
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
    title: '1. Requête SQL & Cache Hit / Miss',
    badge: 'Requête & I/O',
    description: 'Déroulement de l\'exécution d\'un SELECT : de la session au Buffer Cache et à l\'I/O disque en cas de Cache Miss.',
    steps: [
      {
        stepNum: 1,
        title: 'Session Cliente -> Shared Pool (Compilation SQL)',
        from: 'session_client',
        to: 'shared_pool',
        actionText: 'La session transmet la requête SQL. Le CBO vérifie le plan compilé dans la Shared Pool.',
        technicalDetails: 'Si présent : Soft Parse immédiat. Si absent (ex: pas de bind variables) : Hard Parse coûteux en CPU avec contention sur "latch: shared pool".'
      },
      {
        stepNum: 2,
        title: 'Shared Pool -> Buffer Cache (Recherche en Mémoire)',
        from: 'shared_pool',
        to: 'buffer_cache',
        actionText: 'Le processus serveur consulte la table de hachage du Database Buffer Cache dans la SGA.',
        technicalDetails: 'Si le bloc est trouvé en mémoire vive : Cache Hit ! Lecture logique ultra-rapide (Logical Read) sans aucun accès disque.'
      },
      {
        stepNum: 3,
        title: 'Buffer Cache -> Datafiles (Cache Miss & I/O Disque)',
        from: 'buffer_cache',
        to: 'datafiles',
        actionText: 'Le bloc n\'est pas en cache : lecture physique sur les Datafiles du disque.',
        technicalDetails: 'La session entre en état d\'attente (Wait Event) : "db file sequential read" (index mono-bloc) ou "db file scattered read" (Full Table Scan multi-blocs).',
        waitEvent: 'db file sequential / scattered read'
      },
      {
        stepNum: 4,
        title: 'Datafiles -> Buffer Cache -> Session (Chargement)',
        from: 'datafiles',
        to: 'session_client',
        actionText: 'Le bloc est chargé en mémoire SGA et les lignes sont retournées au client.',
        technicalDetails: 'La session sort du Wait Event. Le temps d\'attente est comptabilisé dans le DB Time de l\'AWR.'
      }
    ]
  },
  {
    id: 'ash_sampling',
    title: '2. Échantillonnage ASH Haute Fréquence (1s)',
    badge: 'Microscope ASH',
    description: 'Comment ASH capture chaque seconde l\'état des sessions actives en mémoire vive sans impact CPU, puis décharge vers SYSAUX.',
    steps: [
      {
        stepNum: 1,
        title: 'Session Active -> Tampon Circulaire ASH (1 Seconde)',
        from: 'session_client',
        to: 'ash_buffer',
        actionText: 'Chaque 1 seconde, ASH photographie toutes les sessions actives (sur CPU ou en attente).',
        technicalDetails: 'Parcours en mémoire vive sans verrous lourds (latch-free read). Overhead CPU inférieur à 1% ! Les sessions inactives sont ignorées.'
      },
      {
        stepNum: 2,
        title: 'Enregistrement dans V$ACTIVE_SESSION_HISTORY',
        from: 'ash_buffer',
        to: 'ash_buffer',
        actionText: 'La ligne est écrite dans le tampon circulaire SGA avec le SID, SQL_ID et le Wait Event.',
        technicalDetails: 'Si une session est bloquée par un verrou applicatif (enq: TX), ASH renseigne immédiatement la colonne magique BLOCKING_SESSION.'
      },
      {
        stepNum: 3,
        title: 'Tampon ASH -> MMNL -> SYSAUX (Déchargement 1/10e)',
        from: 'ash_buffer',
        to: 'sysaux',
        actionText: 'Le processus MMNL décharge les données vers le tablespace SYSAUX sur disque avec un ratio de 1 sur 10.',
        technicalDetails: 'Quand le tampon est plein ou après 1 heure, MMNL écrit dans DBA_HIST_ACTIVE_SESS_HISTORY. Le sous-échantillonnage 1/10 économise 90% d\'espace disque.'
      }
    ]
  },
  {
    id: 'awr_snapshot',
    title: '3. Snapshot AWR Périodique par MMON (60 min)',
    badge: 'Boîte Noire AWR',
    description: 'Le mécanisme automatique horaire capturant les compteurs cumulatifs pour le calcul des deltas du rapport AWR.',
    steps: [
      {
        stepNum: 1,
        title: 'Réveil du Processus MMON (Toutes les 60 min)',
        from: 'mmon',
        to: 'buffer_cache',
        actionText: 'Le timer 60 min expire : MMON (Manageability Monitor) lit les compteurs cumulatifs de la SGA.',
        technicalDetails: 'MMON inspecte les statistiques de performance de toute l\'instance (I/O, temps CPU, exécutions SQL, évènements d\'attente).'
      },
      {
        stepNum: 2,
        title: 'Délégation au Processus Esclave m000',
        from: 'mmon',
        to: 'mmon',
        actionText: 'MMON réveille un worker esclave (m000) pour effectuer l\'écriture disque sans bloquer la base.',
        technicalDetails: 'Cette séparation évite que MMON ne soit ralenti par les I/O disque physiques.'
      },
      {
        stepNum: 3,
        title: 'Écriture du Snapshot dans le Tablespace SYSAUX',
        from: 'mmon',
        to: 'sysaux',
        actionText: 'Le worker écrit le cliché horodaté (Snapshot ID) dans les tables WRH$* de SYSAUX.',
        technicalDetails: 'Conservé 8 jours par défaut. Le script awrrpt.sql calcule ensuite la différence entre deux snapshots consécutifs.'
      }
    ]
  },
  {
    id: 'commit_lgwr',
    title: '4. Validation (COMMIT) & Goulot LGWR',
    badge: 'Commit & Redo',
    description: 'Comment une instruction COMMIT réveille LGWR et peut provoquer l\'attente log file sync si committé en boucle.',
    steps: [
      {
        stepNum: 1,
        title: 'Session Cliente -> Redo Log Buffer (COMMIT)',
        from: 'session_client',
        to: 'redo_buffer',
        actionText: 'La session exécute COMMIT : les modifications sont dans le Redo Log Buffer de la SGA.',
        technicalDetails: 'Règle ACID de Durabilité : la transaction n\'est validée que lorsque les vecteurs de redo sont écrits physiquement sur les disques non volatils.'
      },
      {
        stepNum: 2,
        title: 'Attente "log file sync" & Réveil de LGWR',
        from: 'redo_buffer',
        to: 'lgwr',
        actionText: 'La session s\'endort sur l\'évènement "log file sync" et alerte le Log Writer (LGWR).',
        technicalDetails: 'Si l\'application fait des COMMIT dans une boucle PL/SQL (50 000 fois), LGWR sature et "log file sync" explose dans l\'AWR !',
        waitEvent: 'log file sync'
      },
      {
        stepNum: 3,
        title: 'LGWR -> Redo Log Files (Écriture Disque)',
        from: 'lgwr',
        to: 'redofiles',
        actionText: 'LGWR écrit les blocs sur disque physique (log file parallel write) et réveille la session.',
        technicalDetails: 'Le disque confirme l\'écriture. LGWR acquitte la fin du commit. La session se débloque et reçoit "Commit complete".'
      }
    ]
  }
];

function createTextSprite(
  title: string, 
  subtitle?: string, 
  borderColor = '#0ea5e9', 
  bgColor = 'rgba(11, 15, 25, 0.94)',
  textColor = '#38bdf8'
) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = bgColor;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(10, 10, 492, 140, 24);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = textColor;
  ctx.font = 'bold 36px monospace, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = subtitle ? 'top' : 'middle';
  ctx.fillText(title, 256, subtitle ? 26 : 80);

  if (subtitle) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '24px sans-serif';
    ctx.fillText(subtitle, 256, 84);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(4.6, 1.45, 1);
  return sprite;
}

export default function OracleInstance3D() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [selectedComponent, setSelectedComponent] = useState<ComponentDetail>(DETAILS_MAP.ash_buffer);
  const [isRotating, setIsRotating] = useState<boolean>(true);
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [displayMode, setDisplayMode] = useState<'3d' | 'schematic'>('3d');

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
  const labelsGroupRef = useRef<THREE.Group | null>(null);
  const arrowHelperRef = useRef<THREE.ArrowHelper | null>(null);
  const beaconRingsRef = useRef<THREE.Mesh[]>([]);

  // 1. AUTO-PLAY TIMER
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isAutoPlaying) {
      timer = setInterval(() => {
        setActiveStepIndex((prev) => {
          if (prev < activeScenario.steps.length - 1) {
            sounds.playClick();
            return prev + 1;
          } else {
            sounds.playSnapshot();
            return 0;
          }
        });
      }, 4500);
    }
    return () => clearInterval(timer);
  }, [isAutoPlaying, activeScenario]);

  // 2. THREE.JS INITIALIZATION (ALWAYS MOUNTED, NEVER DESTROYED)
  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 650;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x060813);
    scene.fog = new THREE.FogExp2(0x060813, 0.02);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 18, 32);
    camera.lookAt(0, 1, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    container.replaceChildren(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x38bdf8, 2.5);
    dirLight.position.set(15, 25, 20);
    scene.add(dirLight);

    const cyanLight = new THREE.PointLight(0x06b6d4, 3, 35);
    cyanLight.position.set(-8, 4, -6);
    scene.add(cyanLight);

    const pinkLight = new THREE.PointLight(0xec4899, 3, 30);
    pinkLight.position.set(0, 4, 3);
    scene.add(pinkLight);

    const grid = new THREE.GridHelper(44, 44, 0x1e293b, 0x0f172a);
    grid.position.y = -6;
    scene.add(grid);

    // SGA Platform & Wireframe Box
    const sgaGeo = new THREE.BoxGeometry(20, 4.5, 15);
    const sgaEdges = new THREE.EdgesGeometry(sgaGeo);
    const sgaLineMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6 });
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

    const labelsGroup = new THREE.Group();
    scene.add(labelsGroup);
    labelsGroupRef.current = labelsGroup;

    // Header Sprites
    const sgaHeaderSprite = createTextSprite('SGA (System Global Area)', 'Mémoire Partagée Principale', '#38bdf8', 'rgba(2, 132, 199, 0.85)', '#ffffff');
    sgaHeaderSprite.position.set(0, 5.2, -3);
    sgaHeaderSprite.scale.set(7.5, 2.2, 1);
    labelsGroup.add(sgaHeaderSprite);

    const diskHeaderSprite = createTextSprite('STOCKAGE PHYSIQUE (Disques)', 'Datafiles, Redo Logs & SYSAUX', '#3b82f6', 'rgba(15, 23, 42, 0.95)', '#60a5fa');
    diskHeaderSprite.position.set(0, -1.8, 4);
    diskHeaderSprite.scale.set(7.2, 2.0, 1);
    labelsGroup.add(diskHeaderSprite);

    interactiveObjectsRef.current = [];

    const createComponentMesh = (
      detail: ComponentDetail,
      geo: THREE.BufferGeometry,
      color: number,
      opacity = 0.88
    ) => {
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.3,
        metalness: 0.4,
        emissive: color,
        emissiveIntensity: 0.28,
        transparent: opacity < 1,
        opacity
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...detail.position);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      const edges = new THREE.EdgesGeometry(geo);
      const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
      const line = new THREE.LineSegments(edges, lineMat);
      mesh.add(line);

      interactiveObjectsRef.current.push({ id: detail.id, mesh });

      const sprite = createTextSprite(
        detail.name,
        detail.tag,
        detail.color,
        'rgba(11, 15, 25, 0.92)',
        detail.color
      );
      sprite.position.set(detail.position[0], detail.position[1] + 2.4, detail.position[2]);
      labelsGroup.add(sprite);

      return mesh;
    };

    createComponentMesh(DETAILS_MAP.session_client, new THREE.OctahedronGeometry(1.6), 0xa855f7);
    createComponentMesh(DETAILS_MAP.buffer_cache, new THREE.BoxGeometry(6.5, 3.2, 5.5), 0x06b6d4);
    createComponentMesh(DETAILS_MAP.shared_pool, new THREE.BoxGeometry(6.0, 3.2, 5.5), 0x8b5cf6);
    createComponentMesh(DETAILS_MAP.ash_buffer, new THREE.CylinderGeometry(2.2, 2.2, 2.4, 32), 0xec4899);
    createComponentMesh(DETAILS_MAP.redo_buffer, new THREE.BoxGeometry(15, 1.0, 1.6), 0xf97316);

    const procGeo = new THREE.SphereGeometry(1.2, 32, 32);
    createComponentMesh(DETAILS_MAP.mmon, procGeo, 0x10b981);
    createComponentMesh(DETAILS_MAP.mmnl, procGeo, 0xeab308);
    createComponentMesh(DETAILS_MAP.lgwr, procGeo, 0xf43f5e);

    const diskGeo = new THREE.CylinderGeometry(2.6, 2.6, 2.2, 32);
    createComponentMesh(DETAILS_MAP.sysaux, diskGeo, 0x3b82f6);
    createComponentMesh(DETAILS_MAP.datafiles, diskGeo, 0x0284c7, 0.75);
    createComponentMesh(DETAILS_MAP.redofiles, diskGeo, 0xe11d48, 0.75);

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

    let animationId: number;
    let angle = 0;

    const animate = () => {
      animationId = requestAnimationFrame(animate);

      if (isRotating) {
        angle += 0.0022;
        camera.position.x = Math.sin(angle) * 32;
        camera.position.z = Math.cos(angle) * 32;
        camera.position.y = 18;
        camera.lookAt(0, 1, 0);
      }

      const time = Date.now() * 0.003;
      interactiveObjectsRef.current.forEach(({ id, mesh }) => {
        if (id === 'mmon' || id === 'mmnl' || id === 'ash_buffer') {
          const scale = 1 + Math.sin(time * 3 + (id === 'mmon' ? 0 : 2)) * 0.07;
          mesh.scale.set(scale, scale, scale);
        }
      });

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
  }, [isRotating]);

  // Update label visibility
  useEffect(() => {
    if (labelsGroupRef.current) {
      labelsGroupRef.current.visible = showLabels;
    }
  }, [showLabels]);

  // Update 3D Arrow
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;

    if (arrowHelperRef.current) {
      scene.remove(arrowHelperRef.current);
      arrowHelperRef.current = null;
    }

    beaconRingsRef.current.forEach(ring => scene.remove(ring));
    beaconRingsRef.current = [];

    const fromComp = DETAILS_MAP[activeStep.from];
    const toComp = DETAILS_MAP[activeStep.to];

    if (!fromComp || !toComp) return;

    const fromPos = new THREE.Vector3(...fromComp.position);
    const toPos = new THREE.Vector3(...toComp.position);

    const dir = new THREE.Vector3().subVectors(toPos, fromPos);
    const length = dir.length();
    dir.normalize();

    if (length > 0.5) {
      const arrowColor = activeStep.waitEvent ? 0xf43f5e : 0x06b6d4;
      const arrow = new THREE.ArrowHelper(dir, fromPos, length - 1.5, arrowColor, 1.4, 0.9);
      scene.add(arrow);
      arrowHelperRef.current = arrow;
    }

    const ringGeo = new THREE.RingGeometry(1.8, 2.3, 32);
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
      {/* Top Header & Switcher */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-md shadow-2xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-xs font-mono font-semibold text-cyan-400 uppercase tracking-wider">
              Architecture &amp; Scénarios de Flux Oracle
            </span>
          </div>
          <h3 className="text-base font-bold text-white mt-0.5">
            {activeScenario.title}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Switcher 3D vs 2D */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => {
                setDisplayMode('3d');
                sounds.playClick();
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                displayMode === '3d'
                  ? 'bg-cyan-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Vue 3D Flèches</span>
            </button>
            <button
              onClick={() => {
                setDisplayMode('schematic');
                sounds.playClick();
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                displayMode === 'schematic'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Workflow className="w-3.5 h-3.5" />
              <span>Schéma 2D Interactif</span>
            </button>
          </div>

          {/* Scenario Buttons */}
          <div className="flex flex-wrap gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
            {FLOW_SCENARIOS.map((sc, idx) => (
              <button
                key={sc.id}
                onClick={() => handleSelectScenario(idx)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  idx === activeScenarioIndex
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {sc.badge}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Container: Both 3D & 2D are preserved in DOM */}
      <div className="relative w-full rounded-2xl overflow-hidden border border-slate-800 bg-slate-950/90 shadow-2xl flex flex-col lg:flex-row">
        {/* Left Area: 3D View OR 2D Interactive Schematic */}
        <div className="relative flex-1 h-[650px]">
          {/* 3D Canvas Viewport (Always in DOM) */}
          <div 
            className={`w-full h-full cursor-grab active:cursor-grabbing ${
              displayMode === '3d' ? 'block' : 'hidden'
            }`} 
            ref={mountRef}
          >
            {/* 3D Top Overlay */}
            <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setIsRotating(!isRotating);
                  sounds.playClick();
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all shadow-lg ${
                  isRotating
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {isRotating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isRotating ? 'Rotation ON' : 'Rotation Pause'}</span>
              </button>

              <button
                onClick={() => {
                  setShowLabels(!showLabels);
                  sounds.playClick();
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all shadow-lg ${
                  showLabels
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Titres 3D {showLabels ? 'Affichés' : 'Masqués'}</span>
              </button>
            </div>
          </div>

          {/* 2D Interactive Architecture Schematic (Shown when displayMode === 'schematic') */}
          <div 
            className={`w-full h-full p-5 overflow-y-auto flex flex-col justify-between gap-4 bg-[#080d1a] ${
              displayMode === 'schematic' ? 'flex' : 'hidden'
            }`}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-mono font-bold text-purple-400 flex items-center gap-2">
                <Workflow className="w-4 h-4" /> Schéma Interactif 2D : Trajet en Direct
              </span>
              <span className="text-[11px] text-cyan-300 font-mono">
                Étape {activeStep.stepNum} : {DETAILS_MAP[activeStep.from]?.name} ➔ {DETAILS_MAP[activeStep.to]?.name}
              </span>
            </div>

            {/* 2D Circuit Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 flex-1 items-stretch">
              {/* Col 1: Sessions & PGA (3 cols) */}
              <div 
                onClick={() => { setSelectedComponent(DETAILS_MAP.session_client); sounds.playClick(); }}
                className={`md:col-span-3 p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  activeStep.from === 'session_client' || activeStep.to === 'session_client'
                    ? 'bg-purple-950/60 border-purple-500 shadow-lg shadow-purple-500/25 ring-2 ring-purple-400/50'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 text-purple-300 font-bold text-xs uppercase tracking-wider mb-2">
                    <Cpu className="w-4 h-4 text-purple-400" />
                    <span>Sessions &amp; PGA</span>
                  </div>
                  <h4 className="text-sm font-bold text-white">Client / Processus Serveur</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Mémoire privée PGA pour les tris, curseurs utilisateurs et connexions clientes.
                  </p>
                </div>
                <span className="text-[10px] font-mono text-purple-400 mt-3 block">
                  V$SESSION • V$PROCESS
                </span>
              </div>

              {/* Col 2: SGA Container (6 cols) */}
              <div className="md:col-span-6 p-4 rounded-xl bg-cyan-950/20 border-2 border-cyan-500/40 flex flex-col justify-between gap-3">
                <div className="flex items-center justify-between border-b border-cyan-800/40 pb-1.5">
                  <span className="text-xs font-extrabold text-cyan-300 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                    SGA (SYSTEM GLOBAL AREA)
                  </span>
                  <span className="text-[10px] font-mono bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded border border-cyan-800">
                    SGA_TARGET
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {/* Buffer Cache */}
                  <div 
                    onClick={() => { setSelectedComponent(DETAILS_MAP.buffer_cache); sounds.playClick(); }}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      activeStep.from === 'buffer_cache' || activeStep.to === 'buffer_cache'
                        ? 'bg-cyan-950/80 border-cyan-400 shadow-md ring-2 ring-cyan-400/50'
                        : 'bg-slate-900 border-slate-800 hover:border-cyan-500/40'
                    }`}
                  >
                    <span className="text-xs font-bold text-cyan-300 block">Buffer Cache</span>
                    <span className="text-[10px] text-slate-400 leading-tight block mt-0.5">Blocs 8K en mémoire RAM</span>
                    <span className="text-[9px] font-mono text-cyan-400 mt-1 block">DB_CACHE_SIZE</span>
                  </div>

                  {/* Shared Pool */}
                  <div 
                    onClick={() => { setSelectedComponent(DETAILS_MAP.shared_pool); sounds.playClick(); }}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      activeStep.from === 'shared_pool' || activeStep.to === 'shared_pool'
                        ? 'bg-purple-950/80 border-purple-400 shadow-md ring-2 ring-purple-400/50'
                        : 'bg-slate-900 border-slate-800 hover:border-purple-500/40'
                    }`}
                  >
                    <span className="text-xs font-bold text-purple-300 block">Shared Pool</span>
                    <span className="text-[10px] text-slate-400 leading-tight block mt-0.5">Plans SQL &amp; Dictionnaire</span>
                    <span className="text-[9px] font-mono text-purple-400 mt-1 block">V$SQL • Library</span>
                  </div>

                  {/* Tampon ASH */}
                  <div 
                    onClick={() => { setSelectedComponent(DETAILS_MAP.ash_buffer); sounds.playClick(); }}
                    className={`p-3 rounded-xl border transition-all cursor-pointer col-span-2 ${
                      activeStep.from === 'ash_buffer' || activeStep.to === 'ash_buffer'
                        ? 'bg-pink-950/80 border-pink-400 shadow-md ring-2 ring-pink-400/50'
                        : 'bg-slate-900 border-slate-800 hover:border-pink-500/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-pink-300">Tampon Circulaire ASH (1 Seconde)</span>
                      <span className="text-[9px] font-mono bg-pink-950 text-pink-300 px-1.5 py-0.2 rounded">~2 Mo / CPU</span>
                    </div>
                    <span className="text-[10px] text-slate-400 leading-tight block mt-0.5">
                      Échantillonne chaque seconde 100% des sessions actives en RAM sans verrous lourds.
                    </span>
                    <span className="text-[9px] font-mono text-pink-400 mt-1 block">V$ACTIVE_SESSION_HISTORY</span>
                  </div>

                  {/* Redo Log Buffer */}
                  <div 
                    onClick={() => { setSelectedComponent(DETAILS_MAP.redo_buffer); sounds.playClick(); }}
                    className={`p-3 rounded-xl border transition-all cursor-pointer col-span-2 ${
                      activeStep.from === 'redo_buffer' || activeStep.to === 'redo_buffer'
                        ? 'bg-amber-950/80 border-amber-400 shadow-md ring-2 ring-amber-400/50'
                        : 'bg-slate-900 border-slate-800 hover:border-amber-500/40'
                    }`}
                  >
                    <span className="text-xs font-bold text-amber-300 block">Redo Log Buffer</span>
                    <span className="text-[10px] text-slate-400 leading-tight block mt-0.5">Vecteurs de modifications avant validation (COMMIT)</span>
                    <span className="text-[9px] font-mono text-amber-400 mt-1 block">LOG_BUFFER</span>
                  </div>
                </div>
              </div>

              {/* Col 3: Background Processes (3 cols) */}
              <div className="md:col-span-3 flex flex-col justify-between gap-2">
                {/* MMON */}
                <div 
                  onClick={() => { setSelectedComponent(DETAILS_MAP.mmon); sounds.playClick(); }}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                    activeStep.from === 'mmon' || activeStep.to === 'mmon'
                      ? 'bg-emerald-950/80 border-emerald-400 shadow-md ring-2 ring-emerald-400/50'
                      : 'bg-slate-900 border-slate-800 hover:border-emerald-500/40'
                  }`}
                >
                  <span className="text-xs font-bold text-emerald-300 block">MMON (AWR 60m)</span>
                  <span className="text-[10px] text-slate-400">Capture les clichés AWR</span>
                </div>

                {/* MMNL */}
                <div 
                  onClick={() => { setSelectedComponent(DETAILS_MAP.mmnl); sounds.playClick(); }}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                    activeStep.from === 'mmnl' || activeStep.to === 'mmnl'
                      ? 'bg-yellow-950/80 border-yellow-400 shadow-md ring-2 ring-yellow-400/50'
                      : 'bg-slate-900 border-slate-800 hover:border-yellow-500/40'
                  }`}
                >
                  <span className="text-xs font-bold text-yellow-300 block">MMNL (ASH 1/10e)</span>
                  <span className="text-[10px] text-slate-400">Décharge ASH vers SYSAUX</span>
                </div>

                {/* LGWR */}
                <div 
                  onClick={() => { setSelectedComponent(DETAILS_MAP.lgwr); sounds.playClick(); }}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                    activeStep.from === 'lgwr' || activeStep.to === 'lgwr'
                      ? 'bg-rose-950/80 border-rose-400 shadow-md ring-2 ring-rose-400/50'
                      : 'bg-slate-900 border-slate-800 hover:border-rose-500/40'
                  }`}
                >
                  <span className="text-xs font-bold text-rose-300 block">LGWR (Log Writer)</span>
                  <span className="text-[10px] text-slate-400">Écrit lors des COMMITs</span>
                </div>
              </div>
            </div>

            {/* Bottom Row: Disks (SYSAUX, Datafiles, Redo) */}
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-bold font-mono text-slate-400 flex items-center gap-1.5 uppercase">
                <HardDrive className="w-3.5 h-3.5 text-blue-400" /> Stockage Disque Physique :
              </span>

              <div className="flex flex-wrap gap-2 text-xs font-mono">
                {/* SYSAUX */}
                <button
                  onClick={() => { setSelectedComponent(DETAILS_MAP.sysaux); sounds.playClick(); }}
                  className={`px-3 py-1.5 rounded-lg border transition ${
                    activeStep.from === 'sysaux' || activeStep.to === 'sysaux'
                      ? 'bg-blue-900 text-white border-blue-400 shadow-md ring-2 ring-blue-400/50'
                      : 'bg-blue-950/60 text-blue-300 border-blue-800/60 hover:border-blue-400'
                  }`}
                >
                  📁 SYSAUX.DBF (Tables AWR WRH$*)
                </button>

                {/* Datafiles */}
                <button
                  onClick={() => { setSelectedComponent(DETAILS_MAP.datafiles); sounds.playClick(); }}
                  className={`px-3 py-1.5 rounded-lg border transition ${
                    activeStep.from === 'datafiles' || activeStep.to === 'datafiles'
                      ? 'bg-cyan-900 text-white border-cyan-400 shadow-md ring-2 ring-cyan-400/50'
                      : 'bg-cyan-950/60 text-cyan-300 border-cyan-800/60 hover:border-cyan-400'
                  }`}
                >
                  💾 DATAFILES (.dbf : Tables &amp; Index)
                </button>

                {/* Redo Logs */}
                <button
                  onClick={() => { setSelectedComponent(DETAILS_MAP.redofiles); sounds.playClick(); }}
                  className={`px-3 py-1.5 rounded-lg border transition ${
                    activeStep.from === 'redofiles' || activeStep.to === 'redofiles'
                      ? 'bg-rose-900 text-white border-rose-400 shadow-md ring-2 ring-rose-400/50'
                      : 'bg-rose-950/60 text-rose-300 border-rose-800/60 hover:border-rose-400'
                  }`}
                >
                  📝 REDO LOGS (.log : Redo 1, 2, 3)
                </button>
              </div>
            </div>
          </div>

          {/* Floating Trajet Sign (Visible in both 3D and 2D) */}
          <div className="absolute top-4 right-4 z-10 max-w-xs bg-slate-900/95 backdrop-blur p-3.5 rounded-2xl border border-cyan-500/50 shadow-2xl flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-cyan-400 font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> FLÈCHE DE FLUX
              </span>
              <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 text-[10px] border border-cyan-800 font-bold">
                Étape {activeStep.stepNum} / {activeScenario.steps.length}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold text-white pt-1">
              <span className="text-cyan-300 font-mono text-[11px] truncate max-w-[95px]">
                {DETAILS_MAP[activeStep.from]?.name}
              </span>
              <ArrowRight className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-pink-300 font-mono text-[11px] truncate max-w-[95px]">
                {DETAILS_MAP[activeStep.to]?.name}
              </span>
            </div>

            {activeStep.waitEvent && (
              <div className="mt-1 p-1.5 rounded bg-rose-950/60 border border-rose-800/60 text-[10px] text-rose-300 flex items-center gap-1 font-mono font-bold">
                <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                <span>Wait Event: {activeStep.waitEvent}</span>
              </div>
            )}
          </div>

          {/* Step Navigation Bar at bottom */}
          <div className="absolute bottom-4 left-4 right-4 z-10 flex items-center justify-between gap-3 bg-slate-900/95 backdrop-blur-md p-2.5 rounded-2xl border border-slate-800 shadow-2xl">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevStep}
                className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleNextStep}
                className="p-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold hover:brightness-110 shadow-lg shadow-cyan-500/25 transition flex items-center gap-1"
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

        {/* Right Column: Detailed Step Explanation Card (400px) */}
        <div className="w-full lg:w-[400px] p-5 bg-slate-900/95 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col justify-between overflow-y-auto">
          <div>
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

            {/* Inspector of Selected Component */}
            <div className="mt-5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-purple-400" /> Cible : {selectedComponent.name}
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
                  <Database className="w-3 h-3 text-cyan-400" /> Vues Oracle Associées :
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
            <span>Cliquez sur un composant pour l&apos;inspecter</span>
            <span className="font-mono text-cyan-400">Oracle 19c/21c</span>
          </div>
        </div>
      </div>
    </div>
  );
}
