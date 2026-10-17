// Data and educational knowledge base for Oracle AWR & ASH Optimization Platform

export interface WaitEventInfo {
  name: string;
  category: 'User I/O' | 'System I/O' | 'Concurrency' | 'Commit' | 'Configuration' | 'Application';
  description: string;
  symptom: string;
  rootCause: string;
  solution: string;
  awrIndicator: string;
  ashIndicator: string;
  typicalFixSQL: string;
}

export const TOP_WAIT_EVENTS: WaitEventInfo[] = [
  {
    name: 'db file scattered read',
    category: 'User I/O',
    description: 'Lecture multi-blocs depuis les disques vers la SGA lors d\'un Full Table Scan (FTS) ou Fast Full Index Scan.',
    symptom: 'Temps de réponse utilisateur élevé sur des requêtes analytiques ou des écrans de recherche.',
    rootCause: 'Index manquant, statistiques d\'optimiseur obsolètes forçant le CBO (Cost-Based Optimizer) à choisir un scan de table complet, ou clause WHERE non sargeable (ex: UPPER(colonne)).',
    solution: '1. Créer un index approprié (B-Tree ou Composite). 2. Recalculer les statistiques avec DBMS_STATS. 3. Partitionner les grandes tables.',
    awrIndicator: 'Présent dans "Top 10 Foreground Events by Total Wait Time" avec un % Total Call Time élevé et un nombre élevé de Waits.',
    ashIndicator: 'Colonnes EVENT="db file scattered read", CURRENT_OBJ# identifie la table scannée, SQL_ID montre la requête.',
    typicalFixSQL: `-- Création d'index pour éliminer le Full Table Scan
CREATE INDEX idx_orders_customer_date 
ON orders (customer_id, order_date) 
TABLESPACE users;

-- Rafraîchir les statistiques pour le CBO
EXEC DBMS_STATS.GATHER_TABLE_STATS(
    ownname => 'APP_USER',
    tabname => 'ORDERS',
    estimate_percent => DBMS_STATS.AUTO_SAMPLE_SIZE,
    cascade => TRUE
);`
  },
  {
    name: 'db file sequential read',
    category: 'User I/O',
    description: 'Lecture mono-bloc depuis le disque pour accéder à une ligne spécifique via un index B-Tree ou lire les blocs de contrôle/en-têtes.',
    symptom: 'Le temps d\'attente I/O augmente même si des index sont utilisés ; base ralentie sur les accès par clé.',
    rootCause: 'Clustering factor très élevé (l\'index est ordonné différemment des blocs de la table physique), index fragmenté ou Buffer Cache sous-dimensionné (obligé de relire sur disque au lieu de trouver en mémoire).',
    solution: '1. Vérifier le Clustering Factor de l\'index. 2. Agrandir le Buffer Cache (DB_CACHE_SIZE). 3. Réorganiser la table ou index (REBUILD).',
    awrIndicator: 'Évènement #1 en % DB Time, average wait > 10ms (signe de disques lents ou saturation I/O).',
    ashIndicator: 'Plusieurs sessions en attente sur des P1 (file#), P2 (block#) différents dans le même objet index.',
    typicalFixSQL: `-- Vérifier le Clustering Factor de l'index
SELECT index_name, clustering_factor, num_rows, blevel
FROM user_indexes 
WHERE table_name = 'ORDERS';

-- Reconstruire l'index si fragmenté
ALTER INDEX idx_orders_customer_date REBUILD ONLINE;

-- Augmenter dynamiquement le Buffer Cache
ALTER SYSTEM SET db_cache_size = 4G SCOPE=BOTH;`
  },
  {
    name: 'log file sync',
    category: 'Commit',
    description: 'Une session utilisateur a exécuté un COMMIT ou ROLLBACK et attend que le processus d\'arrière-plan LGWR (Log Writer) écrive les blocs du Redo Log Buffer sur les disques Redo Logs.',
    symptom: 'Transactions OLTP ralenties, pics d\'attente lors des validations.',
    rootCause: '1. Application commettant trop fréquemment (ex: COMMIT dans une boucle PL/SQL FOR au lieu d\'un batch commit). 2. Disques de redo logs lents. 3. CPU de l\'instance saturé ralentissant LGWR.',
    solution: '1. Regrouper les commits applicatifs (COMMIT toutes les 1 000 ou 5 000 lignes avec FORALL / BULK COLLECT). 2. Déplacer les fichiers Redo Log sur du stockage SSD/NVMe rapide avec canaux dédiés. 3. Utiliser COMMIT WRITE NOWAIT / BATCH si la perte minime est tolérée.',
    awrIndicator: 'Top Foreground Event avec un nombre de waits colossal (proche du nombre de transactions) et Load Profile "Commits/sec" très élevé.',
    ashIndicator: 'Nombreuses sessions en état WAITING sur "log file sync" pendant que la session LGWR est en attente de "log file parallel write".',
    typicalFixSQL: `-- Mauvaise pratique (Commit en boucle):
-- FOR r IN (SELECT * FROM tmp) LOOP
--    INSERT INTO target VALUES (r.id);
--    COMMIT; -- CATASTROPHE POUR LGWR !
-- END LOOP;

-- Bonne pratique (Bulk processing avec batch commit):
DECLARE
    TYPE t_rows IS TABLE OF target%ROWTYPE;
    v_data t_rows;
BEGIN
    SELECT * BULK COLLECT INTO v_data FROM tmp;
    FORALL i IN 1..v_data.COUNT
        INSERT INTO target VALUES v_data(i);
    COMMIT; -- Un seul commit pour tout le lot !
END;`
  },
  {
    name: 'buffer busy waits',
    category: 'Concurrency',
    description: 'Une session veut accéder à un bloc dans le Buffer Cache, mais une autre session est déjà en train de modifier ce bloc ou de le lire depuis le disque.',
    symptom: 'Contention sévère sur les insertions concurrentes ou les tables de séquences.',
    rootCause: 'Hot block (bloc chaud) : insertions massives simultanées avec une clé primaire croissante où toutes les sessions ciblent le dernier bloc de l\'index, ou contention sur les blocs de segment freelist.',
    solution: '1. Pour un index séquentiel chaud, utiliser un index à clé inversée (REVERSE key index) ou un partitionnement hash. 2. Utiliser ASSM (Automatic Segment Space Management). 3. Augmenter PCTFREE.',
    awrIndicator: 'Top Foreground Event avec mention de "buffer busy waits". Section "Buffer Wait Statistics" montre la classe de bloc ("data block" ou "undo header").',
    ashIndicator: 'ASH montre les mêmes valeurs de P1 (File#) et P2 (Block#) partagées par de nombreuses sessions actives simultanément.',
    typicalFixSQL: `-- Convertir un index à forte contention séquentielle en REVERSE
ALTER INDEX pk_transactions REBUILD REVERSE;

-- Vérifier la classe de bloc responsable
SELECT file#, block#, class, count 
FROM v$waitstat 
WHERE count > 0;`
  },
  {
    name: 'latch: shared pool / library cache',
    category: 'Concurrency',
    description: 'Contention sur les structures internes de la mémoire Shared Pool lors du parsing des requêtes SQL.',
    symptom: 'Saturation CPU de la base de données, requêtes simples prenant des secondes à démarrer.',
    rootCause: 'Hard Parsing Storm : les requêtes utilisent des valeurs littérales concaténées dans le SQL (ex: WHERE id = 123 puis WHERE id = 124) au lieu de variables liées (Bind Variables :id). Le CBO doit recompiler chaque requête.',
    solution: '1. Modifier l\'application pour utiliser des Bind Variables (Prepared Statements). 2. Solution d\'urgence DBA : activer CURSOR_SHARING = FORCE. 3. Augmenter la Shared Pool.',
    awrIndicator: 'Dans "Instance Efficiency Percentages", le ratio "Execute to Parse %" est bas (< 50%) et "Soft Parse %" est bas (< 80%). Section "SQL ordered by Parse Calls" montre des millions de parses.',
    ashIndicator: 'Plusieurs sessions en attente sur "latch: shared pool" avec SQL_ID différents mais avec le même motif textuel (différant juste par une constante).',
    typicalFixSQL: `-- Solution d'urgence immédiate (force le remplacement des constantes par des binds)
ALTER SYSTEM SET cursor_sharing = FORCE SCOPE=BOTH;

-- Vérifier les requêtes non mutualisées dans la Shared Pool
SELECT sql_text, parse_calls, executions, loads
FROM v$sql
WHERE executions = 1 AND parse_calls = 1
ORDER BY sql_text FETCH FIRST 10 ROWS ONLY;`
  },
  {
    name: 'enq: TX - row lock contention',
    category: 'Application',
    description: 'Une session tente de modifier ou verrouiller (SELECT FOR UPDATE) une ligne de table qui est déjà verrouillée par une transaction non validée d\'une autre session.',
    symptom: 'Sessions bloquées indéfiniment, files d\'attente applicatives, requêtes en timeout.',
    rootCause: 'Logique applicative : transaction longue laissant des lignes verrouillées sans faire de COMMIT/ROLLBACK, ou clés étrangères (Foreign Keys) sans index sur la table enfant provoquant un verrouillage de table complet.',
    solution: '1. Identifier la session bloquante via ASH (`BLOCKING_SESSION`) et terminer la transaction ou killer la session. 2. Indexer toutes les colonnes de clés étrangères. 3. Réduire la durée des transactions applicatives.',
    awrIndicator: 'Dans AWR "Top 10 Foreground Events", temps moyen d\'attente élevé (plusieurs secondes par wait). Section "Enqueue Activity" montre un pic sur l\'enqueue TX.',
    ashIndicator: 'L\'outil reine pour ce cas ! Colonne BLOCKING_SESSION et BLOCKING_SESSION_SERIAL# désignent directement le coupable.',
    typicalFixSQL: `-- Identifier la session bloquante avec ASH
SELECT 
    session_id AS waiting_sid,
    blocking_session AS locker_sid,
    sql_id,
    event,
    time_waited
FROM v$active_session_history
WHERE event = 'enq: TX - row lock contention'
  AND sample_time > SYSDATE - INTERVAL '15' MINUTE;

-- Indexer les colonnes de Foreign Keys non indexées
CREATE INDEX idx_order_items_fk 
ON order_items (order_id);`
  }
];

export interface ScenarioGame {
  id: number;
  title: string;
  badge: string;
  context: string;
  urgency: 'Critique' | 'Élevée' | 'Moyenne';
  awrSummary: {
    dbTimePercent: number;
    topEvent: string;
    loadProfileNote: string;
    efficiencyProblem: string;
  };
  ashSummary: {
    timeframe: string;
    activeSessionsPeak: number;
    topSqlId: string;
    culpritDetail: string;
  };
  options: {
    id: string;
    label: string;
    description: string;
    isCorrect: boolean;
    explanation: string;
  }[];
}

export const GAME_SCENARIOS: ScenarioGame[] = [
  {
    id: 1,
    title: 'Incident #1 : Le Pic Mystère de 45 Secondes au Checkout',
    badge: 'AWR Lissage vs ASH Précision',
    context: 'Le service e-commerce a signalé un blocage complet des paiements pendant 45 secondes à 14h22. Le rapport AWR généré entre 14h00 et 15h00 montre des métriques globales tout à fait normales avec une charge moyenne faible. Le management demande pourquoi la base a gelé.',
    urgency: 'Critique',
    awrSummary: {
      dbTimePercent: 12,
      topEvent: 'CPU + db file sequential read (normal)',
      loadProfileNote: 'Charge globale moyennée sur 1 heure : 0.8 sessions actives moyennes (AAS)',
      efficiencyProblem: 'Rien d\'anormal détecté par AWR car le pic est dilué sur 3600 secondes !'
    },
    ashSummary: {
      timeframe: '14:22:10 - 14:22:55 (Fenêtre de 45 secondes)',
      activeSessionsPeak: 96,
      topSqlId: '9xk21a50pbvm9',
      culpritDetail: '48 sessions bloquées en attente de "enq: TX - row lock contention". BLOCKING_SESSION = 142 (SID).'
    },
    options: [
      {
        id: 'A',
        label: 'Agrandir la SGA et ajouter 8 Go de DB_CACHE_SIZE',
        description: 'Penser que la mémoire manquait pour le cache de données.',
        isCorrect: false,
        explanation: 'Faux ! Le problème n\'est pas la mémoire. Agrandir la SGA ne résoudra pas un verrou applicatif bloquant 48 sessions.'
      },
      {
        id: 'B',
        label: 'Utiliser ASH pour identifier la session 142 et ajouter un index sur la clé étrangère',
        description: 'Inspecter V$ACTIVE_SESSION_HISTORY pour localiser la session bloquante et vérifier les contraintes de table enfant.',
        isCorrect: true,
        explanation: 'Excellent diagnostic ! C\'est exactement le cas où AWR est aveugle (car 45s lissées sur 1h ne représentent rien) alors qu\'ASH, échantillonnant chaque seconde, montre immédiatement le pic de 96 sessions et la session bloquante #142.'
      },
      {
        id: 'C',
        label: 'Redémarrer le listener Oracle sous Windows',
        description: 'Supposer que les connexions ont été rejetées au niveau réseau.',
        isCorrect: false,
        explanation: 'Incorrect. Les sessions étaient déjà connectées et en file d\'attente sur un verrou TX applicatif.'
      }
    ]
  },
  {
    id: 2,
    title: 'Incident #2 : Tempête de Full Table Scans sur l\'ERP',
    badge: 'I/O & Optimisation CBO',
    context: 'Depuis la dernière mise en production, l\'ERP comptable met 10 fois plus de temps à générer le bilan mensuel. Les disques du serveur crient grâce et le stockage I/O est saturé à 100%.',
    urgency: 'Élevée',
    awrSummary: {
      dbTimePercent: 88,
      topEvent: 'db file scattered read (76% du DB Time)',
      loadProfileNote: 'Physical Read MB/sec passe de 15 MB/s à 450 MB/s',
      efficiencyProblem: 'Buffer Hit % chute à 62%'
    },
    ashSummary: {
      timeframe: '09:00 - 10:00',
      activeSessionsPeak: 35,
      topSqlId: '7m8v4u19qtx99',
      culpritDetail: 'CURRENT_OBJ# pointe vers la table FACTURES (25 millions de lignes). Plan d\'exécution indique TABLE ACCESS FULL.'
    },
    options: [
      {
        id: 'A',
        label: 'Créer un index composite sur (CODE_CLIENT, DATE_FACTURE) et recalculer les stats',
        description: 'Remplacer le scan de 25M lignes par un accès indexé ciblé.',
        isCorrect: true,
        explanation: 'Parfait ! L\'évènement "db file scattered read" dominant à 76% dans AWR est la signature typique d\'un Full Table Scan massif. L\'index élimine les 450 MB/s de lecture disque et ramène le temps de requête à quelques millisecondes.'
      },
      {
        id: 'B',
        label: 'Augmenter le paramètre DB_FILE_MULTIBLOCK_READ_COUNT',
        description: 'Permettre de lire encore plus de blocs en une seule lecture.',
        isCorrect: false,
        explanation: 'Mauvaise idée ! Augmenter ce paramètre rend les Full Table Scans encore plus "attractifs" pour l\'optimiseur CBO et aggraverait la saturation I/O.'
      },
      {
        id: 'C',
        label: 'Reconstruire le fichier de contrôle control01.ctl',
        description: 'Réparer la métadonnée du système.',
        isCorrect: false,
        explanation: 'Sans aucun rapport avec un problème de requête non indexée sur une table métier.'
      }
    ]
  },
  {
    id: 3,
    title: 'Incident #3 : Hard Parse Catastrophe & CPU à 100%',
    badge: 'Shared Pool & Bind Variables',
    context: 'Les serveurs d\'application ont déployé une mise à jour d\'un microservice NodeJS. Immédiatement, le CPU des processeurs Oracle passe à 99% alors que le volume de données manipulé n\'a pas changé.',
    urgency: 'Critique',
    awrSummary: {
      dbTimePercent: 94,
      topEvent: 'latch: shared pool / latch: library cache',
      loadProfileNote: 'Parse/sec = 18,200 | Hard Parse/sec = 17,900',
      efficiencyProblem: 'Execute to Parse % = 12% | Soft Parse % = 2%'
    },
    ashSummary: {
      timeframe: '11:15 - 11:30',
      activeSessionsPeak: 80,
      topSqlId: 'Multiple SQL_IDs (Chaque requête a un hash différent !)',
      culpritDetail: 'SQL Text contient : SELECT * FROM USERS WHERE EMAIL = \'toto@test.com\', etc. Pas de bind variables !'
    },
    options: [
      {
        id: 'A',
        label: 'Activer CURSOR_SHARING=FORCE en urgence et corriger le code avec des variables liées (:1)',
        description: 'Forcer Oracle à remplacer les littéraux par des bind variables pour mutualiser les curseurs.',
        isCorrect: true,
        explanation: 'Bravo ! Avec 17 900 Hard Parses par seconde, chaque requête est recompilée de zéro, ce qui verrouille la Shared Pool (latch contention) et consume tout le CPU. CURSOR_SHARING=FORCE résout immédiatement la crise en attendant la correction du code.'
      },
      {
        id: 'B',
        label: 'Vider le cache avec ALTER SYSTEM FLUSH SHARED_POOL',
        description: 'Nettoyer la mémoire partagée pour libérer de l\'espace.',
        isCorrect: false,
        explanation: 'Dangereux ! Vider la Shared Pool supprime le peu de curseurs déjà compilés et va amplifier la tempête de compilation (Hard Parsing) jusqu\'à faire crasher les connexions.'
      },
      {
        id: 'C',
        label: 'Ajouter plus de fichiers de Redo Logs',
        description: 'Soulager les écritures de journalisation.',
        isCorrect: false,
        explanation: 'Hors sujet. Les redo logs n\'interviennent pas dans la phase d\'analyse syntaxique et sémantique (parsing) des requêtes en mémoire.'
      }
    ]
  },
  {
    id: 4,
    title: 'Incident #4 : Goulot d\'Étranglement Redo Log & Commit en Boucle',
    badge: 'Commit Bottleneck & LGWR',
    context: 'Un script de migration de données insère 500 000 lignes dans une table de log. Le script prend 2 heures au lieu de 2 minutes. La base semble bloquée sur chaque insertion.',
    urgency: 'Moyenne',
    awrSummary: {
      dbTimePercent: 82,
      topEvent: 'log file sync (Average wait: 14.2ms, Waits: 500 120)',
      loadProfileNote: 'User commits/sec = 4,200',
      efficiencyProblem: 'Le processus LGWR est saturé par les demandes de synchro disque.'
    },
    ashSummary: {
      timeframe: '02:00 - 04:00 (Nuit)',
      activeSessionsPeak: 2,
      topSqlId: '2b4c5d6e7f8g9',
      culpritDetail: 'Session 88 exécute une boucle PL/SQL avec un COMMIT; à l\'intérieur de la boucle.'
    },
    options: [
      {
        id: 'A',
        label: 'Remplacer le COMMIT unitaire par un FORALL / BULK COLLECT avec un commit global par lot',
        description: 'Ne synchroniser les Redo Logs qu\'une fois toutes les 10 000 lignes ou à la fin du traitement.',
        isCorrect: true,
        explanation: 'Exactement ! Chaque COMMIT force LGWR à vider le Redo Log Buffer sur le disque physique et la session attend l\'évènement "log file sync". 500 000 commits = 500 000 I/O disques inutiles ! En groupant les commits, le script passe de 2 heures à 12 secondes.'
      },
      {
        id: 'B',
        label: 'Augmenter la taille du PGA_AGGREGATE_TARGET',
        description: 'Allouer plus de mémoire de tri à la session.',
        isCorrect: false,
        explanation: 'Inutile. Le tri n\'est pas la cause de l\'attente ; c\'est la synchronisation disque des fichiers Redo Logs qui bloque.'
      },
      {
        id: 'C',
        label: 'Désactiver le mode ARCHIVELOG',
        description: 'Empêcher la sauvegarde des transactions.',
        isCorrect: false,
        explanation: 'Inadmissible en production ! Désactiver ARCHIVELOG détruit la possibilité de récupération après crash et ne règle pas le besoin de LGWR d\'écrire les Redo Logs actifs.'
      }
    ]
  },
  {
    id: 5,
    title: 'Incident #5 : Buffer Cache Starvation & Advisory Statistics',
    badge: 'Memory Sizing & AWR Advisory',
    context: 'Sur une base Oracle 19c sous Windows Server, les requêtes OLTP subissent des temps de latence aléatoires. La mémoire totale allouée au Buffer Cache est actuellement de 1 Go sur une machine disposant de 64 Go de RAM.',
    urgency: 'Élevée',
    awrSummary: {
      dbTimePercent: 71,
      topEvent: 'db file sequential read',
      loadProfileNote: 'Physical Read Total IOPS élevé, relecture permanente des mêmes blocs.',
      efficiencyProblem: 'Section "Buffer Pool Advisory" de l\'AWR indique un facteur 4.0 (4 Go) réduirait les lectures physiques de 83% !'
    },
    ashSummary: {
      timeframe: '08:00 - 18:00',
      activeSessionsPeak: 22,
      topSqlId: '4k8j2h1g6f5d',
      culpritDetail: 'Les blocs récemment consultés sont constamment éjectés de la LRU list par manque de place.'
    },
    options: [
      {
        id: 'A',
        label: 'Ajuster dynamiquement DB_CACHE_SIZE à 8 Go ou configurer MEMORY_TARGET adéquat',
        description: 'Exploiter les conseils de dimensionnement prédictifs de la section "Buffer Pool Advisory" du rapport AWR.',
        isCorrect: true,
        explanation: 'Superbe décision ! L\'AWR contient une section magique souvent ignorée : les "Advisory Statistics" (Buffer Pool Advisory, Shared Pool Advisory, PGA Advisory). Elle calcule avec précision mathématique le gain d\'I/O pour chaque palier de mémoire.'
      },
      {
        id: 'B',
        label: 'Créer un tablespace temporaire supplémentaire',
        description: 'Augmenter l\'espace de tri sur disque.',
        isCorrect: false,
        explanation: 'Le problème concerne le cache des blocs de données (Buffer Cache), pas les tablespaces temporaires (TEMP).'
      },
      {
        id: 'C',
        label: 'Activer l\'indexation bitmap sur toutes les colonnes',
        description: 'Compresser les index pour gagner de la place.',
        isCorrect: false,
        explanation: 'Très dangereux sur un environnement OLTP ! Les index bitmap verrouillent tout le segment de lignes lors d\'une modification et provoqueraient des blocages massifs.'
      }
    ]
  }
];

export interface PresentationSlide {
  id: number;
  timeRange: string;
  minuteBadge: string;
  title: string;
  subtitle: string;
  keyPoints: string[];
  oracleConcepts: { label: string; description: string }[];
  speakerNotes: string; // Exact words the student can say to the professor!
  diagramType: 'architecture' | 'awr_vs_ash' | 'wait_events' | 'live_demo' | 'windows_view';
  callout: { type: 'tip' | 'warning' | 'key'; text: string };
}

export const PRESENTATION_SLIDES: PresentationSlide[] = [
  {
    id: 1,
    timeRange: '00:00 - 02:00',
    minuteBadge: 'Min 0 - 2 : Fondations',
    title: '1. Architecture Interne & La Règle d\'Or du DB Time',
    subtitle: 'Ce qu\'il faut impérativement comprendre avant de lire un rapport',
    keyPoints: [
      'La SGA (System Global Area) héberge le Buffer Cache, la Shared Pool et le Redo Log Buffer.',
      'Les processus d\'arrière-plan cruciaux : MMON (AWR) et MMNL (ASH).',
      'Le concept maître : DB Time = CPU Time + Wait Time (Temps passé par toutes les sessions actives).',
      'Si DB Time > Temps écoulé × Nombre de CPU, le système subit une saturation évidente.'
    ],
    oracleConcepts: [
      { label: 'SGA (Shared Memory)', description: 'Mémoire partagée accessible par tous les processus serveurs.' },
      { label: 'DB Time', description: 'Métrique unifiée d\'effort : somme du temps CPU et de tous les temps d\'attente des sessions actives.' },
      { label: 'Wait Events', description: 'États d\'attente instrumentés par Oracle (ex: I/O disque, verrous, synchronisation).' },
      { label: 'MMON vs MMNL', description: 'MMON prend les clichés AWR (60 min). MMNL échantillonne l\'ASH (1 seconde).' }
    ],
    speakerNotes: '« Monsieur le Professeur, chers collègues, pour optimiser une base Oracle, nous ne devons pas deviner : nous devons mesurer. Tout le diagnostic repose sur une métrique reine : le DB Time. Le DB Time représente la somme totale du temps passé par les sessions soit à travailler sur le processeur (CPU Time), soit à attendre une ressource (Wait Time). Deux processus d\'arrière-plan sont au cœur de notre sujet : MMON, qui capture l\'AWR à intervalle macroscopique, et MMNL, qui échantillonne l\'ASH à la seconde. »',
    diagramType: 'architecture',
    callout: {
      type: 'key',
      text: 'Formule clé à retenir : Average Active Sessions (AAS) = DB Time / Elapsed Time. Si AAS dépasse le nombre de cœurs CPU, la base est en surcharge !'
    }
  },
  {
    id: 2,
    timeRange: '02:00 - 04:00',
    minuteBadge: 'Min 2 - 4 : AWR Décrypté',
    title: '2. AWR (Automatic Workload Repository) : La Boîte Noire',
    subtitle: 'Historisation globale, snapshots horaires et analyse macroscopique',
    keyPoints: [
      'Clichés automatiques (Snapshots) toutes les 60 minutes, stockés dans le tablespace SYSAUX pendant 8 jours.',
      'Généré via le script officiel : @?/rdbms/admin/awrrpt.sql (format HTML ou Text).',
      'Vues sous-jacentes : DBA_HIST_SNAPSHOT, DBA_HIST_SYSSTAT, DBA_HIST_SQLSTAT.',
      'Structure du rapport : Load Profile, Instance Efficiency, Top 10 Foreground Events, Top SQL, Memory Advisories.'
    ],
    oracleConcepts: [
      { label: 'Snapshots', description: 'Photographies périodiques des compteurs cumulatifs de performance.' },
      { label: 'Delta Metrics', description: 'AWR calcule la différence entre deux snapshots pour donner l\'activité exacte de la période.' },
      { label: 'Load Profile', description: 'Taux par seconde et par transaction (Logical Reads, Physical Reads, Commits, Hard Parses).' },
      { label: 'Top 10 Wait Events', description: 'Classement des évènements ayant consommé le plus de DB Time.' }
    ],
    speakerNotes: '« AWR est la boîte noire de la base de données. Toutes les heures, le processus MMON réveille un worker et capture un snapshot vers le tablespace SYSAUX. Quand nous générons un rapport AWR avec awrrpt.sql, Oracle compare deux snapshots et calcule le différentiel. Nous lisons d\'abord le Load Profile pour mesurer l\'intensité du travail, puis le tableau des Top 10 Foreground Wait Events pour savoir immédiatement quel goulot d\'étranglement freine la production. »',
    diagramType: 'awr_vs_ash',
    callout: {
      type: 'tip',
      text: 'Astuce DBA : Toujours comparer un rapport AWR de période de crise avec un rapport AWR d\'une période saine identique (ex: même heure la semaine passée) !'
    }
  },
  {
    id: 3,
    timeRange: '04:00 - 06:00',
    minuteBadge: 'Min 4 - 6 : ASH Le Microscope',
    title: '3. ASH (Active Session History) : Le Microscope Haute Fréquence',
    subtitle: 'Échantillonnage à la seconde pour capturer les pics éphémères',
    keyPoints: [
      'Problème majeur d\'AWR : Le lissage ! Une panne violente de 45 secondes est complètement diluée sur 1 heure.',
      'Solution ASH : Échantillonne chaque seconde toutes les sessions actives (WAITING ou ON CPU).',
      'Stocké d\'abord en mémoire vive SGA dans un tampon circulaire (V$ACTIVE_SESSION_HISTORY), overhead négligeable (< 1% CPU).',
      'Déchargement sur disque à 1 échantillon sur 10 par MMNL vers DBA_HIST_ACTIVE_SESS_HISTORY.',
      'Généré via le script : @?/rdbms/admin/ashrpt.sql avec une granularité jusqu\'à la minute près.'
    ],
    oracleConcepts: [
      { label: 'V$ACTIVE_SESSION_HISTORY', description: 'Tampon circulaire en mémoire vive (quelques dizaines de Mo dans la SGA).' },
      { label: '1 Session / 1 Sec', description: 'Seules les sessions qui travaillent activement sont échantillonnées (pas les sessions inactives).' },
      { label: '1 Échantillon sur 10', description: 'Lors du passage en disque vers SYSAUX, 1 ligne sur 10 est conservée pour limiter l\'espace disque.' },
      { label: 'BLOCKING_SESSION', description: 'Pointeur direct vers le SID de la session à l\'origine du verrouillage.' }
    ],
    speakerNotes: '« Si AWR est une photo satellite prise toutes les heures, ASH est une caméra haute vitesse filmant à la seconde. Imaginez un pic de blocage de 45 secondes où 100 sessions attendent un verrou. Dans AWR, divisé par 3600 secondes, ce pic est invisible ! Avec ASH, nous ciblons exactement la plage horaire de 14h22 à 14h23 via ashrpt.sql. En une seconde, ASH nous donne le SQL_ID coupable, le numéro de bloc disque, et la session bloquante. »',
    diagramType: 'awr_vs_ash',
    callout: {
      type: 'warning',
      text: 'Attention piège prof : V$ACTIVE_SESSION_HISTORY est volatile en cas de crash de l\'instance. Pour analyser un crash passé, il faut interroger DBA_HIST_ACTIVE_SESS_HISTORY !'
    }
  },
  {
    id: 4,
    timeRange: '06:00 - 08:00',
    minuteBadge: 'Min 6 - 8 : Top Wait Events & Diagnostics',
    title: '4. Les Cas Réels de Production & Leurs Solutions',
    subtitle: 'Comment interpréter les symptômes et apporter le remède immédiat',
    keyPoints: [
      'db file scattered read : Full Table Scan massif -> Créer un index, partitionner, vérifier les stats CBO.',
      'db file sequential read : Index lent / fragmenté ou Buffer Cache trop petit -> Rebuild index, agrandir DB_CACHE_SIZE.',
      'log file sync : Commits intempestifs en boucle -> Regrouper les commits par lots (Bulk Collect / FORALL).',
      'latch: shared pool / library cache : Hard parse storm -> Utiliser des Bind Variables (:id) ou CURSOR_SHARING=FORCE.',
      'enq: TX - row lock contention : Verrou applicatif non libéré ou clé étrangère non indexée -> Identifier le SID bloquant avec ASH.'
    ],
    oracleConcepts: [
      { label: 'Scattered vs Sequential', description: 'Scattered = Multi-blocs (Full Table Scan). Sequential = Mono-bloc (Index lookup).' },
      { label: 'Hard Parse vs Soft Parse', description: 'Hard Parse = compilation complète du plan (coûteux en CPU). Soft Parse = réutilisation du plan.' },
      { label: 'Log File Sync', description: 'Attente du COMMIT. Chaque commit force une écriture physique sur les disques Redo.' },
      { label: 'Advisories AWR', description: 'Simulateurs intégrés d\'Oracle pour estimer le gain avant de changer les paramètres mémoire.' }
    ],
    speakerNotes: '« En production, 90% des problèmes de performance se résument à cinq grands coupables dans le rapport AWR : si vous voyez "db file scattered read", une requête fait un Full Table Scan sur des millions de lignes par manque d\'index. Si vous voyez "log file sync", un développeur a mis un COMMIT à l\'intérieur d\'une boucle. Si le CPU plafonne à 100% avec des latches de Shared Pool, ce sont des requêtes sans variables liées qui saturent le compilateur. »',
    diagramType: 'wait_events',
    callout: {
      type: 'tip',
      text: 'Conseil d\'expert : Le "Buffer Cache Hit Ratio" à 99% ne signifie pas que tout va bien. Une requête inefficace qui lit 10 millions de blocs en mémoire aura un ratio de 100% tout en écrasant le CPU !'
    }
  },
  {
    id: 5,
    timeRange: '08:00 - 10:00',
    minuteBadge: 'Min 8 - 10 : Démo Live TP & Windows',
    title: '5. Travaux Pratiques en Direct & Spécificités Windows',
    subtitle: 'Génération devant l\'assistance et inspection des entrailles du système',
    keyPoints: [
      'Génération SQL*Plus en direct : création manuelle de snapshot avec DBMS_WORKLOAD_REPOSITORY.CREATE_SNAPSHOT().',
      'Exécution interactive d\'awrrpt.sql et ashrpt.sql.',
      'Particularité majeure d\'Oracle sous Windows : oracle.exe est un processus unique multi-threadé (alors que sous Linux/Unix, chaque processus d\'arrière-plan et serveur a son propre PID).',
      'Fichiers cruciaux : Alert Log dans l\'ADR (%ORACLE_BASE%\\diag\\rdbms\\...\\trace\\alert_<SID>.log), SPFILE<SID>.ORA, listener.ora.',
      'Services Windows : OracleService<SID> et Oracle<Home>TNSListener.'
    ],
    oracleConcepts: [
      { label: 'awrrpt.sql', description: 'Script Oracle standard pour extraire le rapport AWR en HTML ou texte.' },
      { label: 'ashrpt.sql', description: 'Script Oracle standard pour générer un rapport ASH sur une plage horaire fine.' },
      { label: 'ADR (Automatic Diagnostic Repository)', description: 'Arborescence standardisée pour les alert logs, traces et incidents.' },
      { label: 'Windows Architecture', description: 'Oracle sous Windows utilise des threads natifs dans oracle.exe au lieu de processus séparés.' }
    ],
    speakerNotes: '« Pour conclure cette présentation, nous allons générer en direct les rapports devant vous en SQL*Plus. Nous déclenchons un snapshot manuel avec DBMS_WORKLOAD_REPOSITORY, puis nous lançons awrrpt.sql. Enfin, rappelons qu\'en environnement Windows, Oracle ne fonctionne pas comme sous Linux : l\'ensemble de l\'instance tourne au sein d\'un unique exécutable multi-threadé nommé oracle.exe, supervisé par le service Windows OracleServiceORCL. »',
    diagramType: 'live_demo',
    callout: {
      type: 'key',
      text: 'Outils de diagnostic Windows : Process Explorer de Sysinternals permet d\'inspecter les threads individuels d\'oracle.exe et de mapper le TID (Thread ID) Windows vers le SPID Oracle de V$PROCESS !'
    }
  }
];

export const WINDOWS_ORACLE_FILES = [
  {
    path: '%ORACLE_BASE%\\diag\\rdbms\\<db_name>\\<SID>\\trace\\alert_<SID>.log',
    name: 'Alert Log (Journal Principal)',
    role: 'Journal chronologique d\'évènements majeurs, erreurs ORA-, démarrages, arrêts, checkpoints et sauvegardes.',
    icon: 'FileText',
    inspectionCmd: 'Get-Content -Path $env:ORACLE_BASE\\diag\\rdbms\\orcl\\orcl\\trace\\alert_orcl.log -Tail 100 -Wait'
  },
  {
    path: '%ORACLE_HOME%\\database\\SPFILE<SID>.ORA',
    name: 'SPFILE (Server Parameter File)',
    role: 'Fichier binaire des paramètres d\'initialisation du serveur (SGA, PGA, processus, nom de la base). Modifiable par ALTER SYSTEM.',
    icon: 'Database',
    inspectionCmd: 'sqlplus / as sysdba -> SHOW PARAMETER SPFILE;'
  },
  {
    path: '%ORACLE_HOME%\\network\\admin\\listener.ora',
    name: 'Listener Configuration',
    role: 'Définit le port d\'écoute (1521 par défaut), les protocoles et les services enregistrés pour les connexions clientes.',
    icon: 'Network',
    inspectionCmd: 'lsnrctl status'
  },
  {
    path: '%ORACLE_HOME%\\network\\admin\\tnsnames.ora',
    name: 'TNS Names (Résolution Client)',
    role: 'Alias réseau permettant aux applications et outils clients de localiser l\'instance Oracle (Hôte, Port, Service Name).',
    icon: 'Server',
    inspectionCmd: 'tnsping ORCL'
  },
  {
    path: 'C:\\Windows\\System32\\services.msc (Services Windows)',
    name: 'Services Windows Oracle',
    role: 'Supervision de l\'instance : "OracleService<SID>" démarre l\'exécutable oracle.exe, et "OracleOraDB19Home1TNSListener" gère l\'écouteur.',
    icon: 'Cpu',
    inspectionCmd: 'Get-Service Oracle*'
  }
];

export const PROFESSOR_QUESTIONS = [
  {
    id: 1,
    question: 'Quelle est la différence fondamentale entre le DB Time et le temps écoulé (Elapsed Time) ?',
    answer: 'L\'Elapsed Time est le temps réel du chronomètre entre deux snapshots (ex: 60 minutes). Le DB Time est la somme cumulée du temps passé par TOUTES les sessions actives sur le CPU ou en attente. Ainsi, sur un serveur à 16 cœurs avec 10 sessions très actives tournant pendant 1 heure, le DB Time peut atteindre 10 heures ! Le ratio (DB Time / Elapsed Time) donne l\'AAS (Average Active Sessions).',
    trap: 'Beaucoup d\'étudiants pensent que le DB Time ne peut pas dépasser 60 minutes pour un snapshot d\'une heure.',
    tag: 'Concept Fondamental'
  },
  {
    id: 2,
    question: 'Pourquoi ASH échantillonne 1 session sur 10 lorsqu\'il décharge ses données de la mémoire vers le disque (DBA_HIST) ?',
    answer: 'Pour éviter de saturer le tablespace SYSAUX et ne pas engendrer d\'overhead I/O excessif. En mémoire SGA (V$ACTIVE_SESSION_HISTORY), la fréquence est de 1 seconde pour 100% des sessions actives. Quand le tampon est plein ou après 1 heure, le processus MMNL copie les données dans DBA_HIST_ACTIVE_SESS_HISTORY en appliquant un sous-échantillonnage de 1 sur 10. Les lois statistiques garantissent que pour des analyses sur plusieurs jours, un échantillon de 10% conserve une précision mathématique remarquable.',
    trap: 'Croire qu\'ASH perd les informations critiques en diminuant la fréquence.',
    tag: 'Architecture Interne'
  },
  {
    id: 3,
    question: 'Si le Buffer Cache Hit Ratio est de 99.5%, peut-on affirmer que la base de données est parfaitement optimisée ?',
    answer: 'Absolument PAS ! C\'est le piège classique des années 90. Un Hit Ratio élevé signifie seulement que les blocs demandés sont déjà en mémoire. Si une mauvaise requête sans index parcourt 5 millions de blocs en boucle (Logical Reads) au lieu d\'accéder à 3 blocs via un index, ces 5 millions de lectures en mémoire vont saturer le CPU et les latches du cache, tout en affichant un Hit Ratio de 99.9% ! On optimise en réduisant les Logical Reads globaux, pas en maximisant aveuglément le Hit Ratio.',
    trap: 'Se fier uniquement aux pourcentages d\'efficacité sans regarder le Load Profile et le DB Time.',
    tag: 'Piège Classique'
  },
  {
    id: 4,
    question: 'Quels sont les prérequis de licence Oracle pour exploiter légalement AWR et ASH ?',
    answer: 'Il faut posséder la licence Oracle Database Enterprise Edition ainsi que l\'option payante "Oracle Diagnostic Pack". Sur une édition Standard (SE2), AWR et ASH ne sont pas sous licence. En SE2, les DBA utilisent Statspack (gratuit et inclus via @?/rdbms/admin/spcreate.sql) ou des outils tiers open source.',
    trap: 'Penser qu\'AWR est disponible gratuitement sur toutes les éditions Oracle.',
    tag: 'Licensing & Gouvernance'
  },
  {
    id: 5,
    question: 'Quelle est la différence architecturale majeure d\'Oracle Database sous Windows comparé à Linux ?',
    answer: 'Sous Linux/UNIX, chaque processus d\'arrière-plan (pmon, smon, lgwr, dbwr) et chaque processus serveur dédié est un processus système distinct visible avec "ps -ef". Sous Windows, l\'architecture est entièrement multi-threadée : il n\'y a qu\'un seul processus parent nommé "oracle.exe", et tous les composants (LGWR, DBWR, sessions utilisateurs) sont des threads Windows internes à ce processus.',
    trap: 'Chercher les processus "ora_pmon_..." avec le Gestionnaire de Tâches Windows.',
    tag: 'Windows vs Unix'
  },
  {
    id: 6,
    question: 'Comment ASH parvient-il à ne pas ralentir la base de données lors de son échantillonnage chaque seconde ?',
    answer: 'ASH n\'utilise aucun verrou lourd (enqueue). Il lit directement l\'état des sessions en mémoire vive SGA via des mécanismes sans latch (latch-free read ou fast pointer traversal). De plus, il n\'examine QUE les sessions en état actif (waiting ou running sur CPU) et ignore totalement les centaines de sessions inactives en attente du client (SQL*Net message from client). L\'impact CPU mesuré est strictement inférieur à 1%.',
    trap: 'Penser qu\'ASH trace toutes les sessions connectées.',
    tag: 'Performance & Overhead'
  }
];

export const MOCK_AWR_DATA = {
  header: {
    dbName: 'PROD_ORCL',
    dbId: '1849204912',
    instance: 'orcl1',
    version: '19.3.0.0.0',
    host: 'WIN-SRV-DB01 (Windows Server 2022, 16 CPUs, 64 GB RAM)',
    beginSnap: 4520,
    endSnap: 4521,
    beginTime: '17-Oct-26 14:00:00',
    endTime: '17-Oct-26 15:00:00',
    elapsedMinutes: 60.00,
    dbTimeMinutes: 284.50
  },
  loadProfile: [
    { metric: 'DB Time (s)', perSec: '4.74', perTxn: '1.25' },
    { metric: 'DB CPU (s)', perSec: '1.12', perTxn: '0.30' },
    { metric: 'Redo size (bytes)', perSec: '1,452,890', perTxn: '383,210' },
    { metric: 'Logical read (blocks)', perSec: '82,450', perTxn: '21,750' },
    { metric: 'Physical read (blocks)', perSec: '4,890', perTxn: '1,290' },
    { metric: 'User calls', perSec: '1,840', perTxn: '485' },
    { metric: 'Parses', perSec: '240', perTxn: '63' },
    { metric: 'Hard parses', perSec: '18.4', perTxn: '4.8' },
    { metric: 'Logons', perSec: '0.4', perTxn: '0.1' },
    { metric: 'Executes', perSec: '2,150', perTxn: '567' },
    { metric: 'Rollbacks', perSec: '0.02', perTxn: '0.00' },
    { metric: 'Transactions', perSec: '3.79', perTxn: '1.00' }
  ],
  efficiency: [
    { name: 'Buffer Nowait %', value: '99.98', benchmark: '> 99%' },
    { name: 'Buffer Hit %', value: '94.07', benchmark: '> 90%' },
    { name: 'Library Hit %', value: '98.54', benchmark: '> 95%' },
    { name: 'Execute to Parse %', value: '88.84', benchmark: '> 80%' },
    { name: 'Parse CPU to Parse Elapsd %', value: '84.20', benchmark: '> 70%' },
    { name: 'Redo NoWait %', value: '100.00', benchmark: '100%' },
    { name: 'Soft Parse %', value: '92.33', benchmark: '> 95%' },
    { name: 'Latch Hit %', value: '99.88', benchmark: '> 99%' }
  ],
  topEvents: [
    {
      event: 'db file scattered read',
      waits: '248,900',
      totalWaitTimeSec: '8,420',
      avgWaitMs: '33.8',
      pctDBTime: '49.3',
      waitClass: 'User I/O',
      diagnosis: 'Full Table Scan massif sur table ORDERS (Index manquant)'
    },
    {
      event: 'DB CPU',
      waits: '-',
      totalWaitTimeSec: '4,032',
      avgWaitMs: '-',
      pctDBTime: '23.6',
      waitClass: 'CPU',
      diagnosis: 'Calculs et parcours de blocs mémoire dans la SGA'
    },
    {
      event: 'db file sequential read',
      waits: '184,200',
      totalWaitTimeSec: '2,410',
      avgWaitMs: '13.1',
      pctDBTime: '14.1',
      waitClass: 'User I/O',
      diagnosis: 'Lectures d\'index sur stockage disque physique'
    },
    {
      event: 'log file sync',
      waits: '13,640',
      totalWaitTimeSec: '980',
      avgWaitMs: '71.8',
      pctDBTime: '5.7',
      waitClass: 'Commit',
      diagnosis: 'Temps d\'attente LGWR anormalement élevé lors des validations'
    },
    {
      event: 'enq: TX - row lock contention',
      waits: '48',
      totalWaitTimeSec: '620',
      avgWaitMs: '12916.7',
      pctDBTime: '3.6',
      waitClass: 'Application',
      diagnosis: 'Verrous sur lignes concurrentes au niveau applicatif'
    }
  ],
  topSql: [
    {
      sqlId: '7m8v4u19qtx99',
      elapsedTimeSec: '5,820',
      cpuTimeSec: '1,420',
      executions: '24',
      elapPerExecSec: '242.5',
      pctDBTime: '34.1',
      sqlText: 'SELECT o.order_id, c.customer_name, SUM(i.price) FROM orders o JOIN customers c ON ...'
    },
    {
      sqlId: '9xk21a50pbvm9',
      elapsedTimeSec: '2,940',
      cpuTimeSec: '410',
      executions: '1,840',
      elapPerExecSec: '1.6',
      pctDBTime: '17.2',
      sqlText: 'UPDATE inventory SET stock = stock - :1 WHERE product_id = :2'
    },
    {
      sqlId: '2b4c5d6e7f8g9',
      elapsedTimeSec: '1,890',
      cpuTimeSec: '890',
      executions: '45,000',
      elapPerExecSec: '0.04',
      pctDBTime: '11.0',
      sqlText: 'INSERT INTO audit_log (log_date, action_id, user_id) VALUES (SYSDATE, :1, :2)'
    }
  ]
};

export const MOCK_ASH_DATA = {
  header: {
    dbName: 'PROD_ORCL',
    timeWindow: '17-Oct-26 14:22:00 à 14:23:00 (Fenêtre critique de 60 secondes)',
    sampleCount: 1840,
    activeSessionsPeak: 68
  },
  timelineSamples: [
    { second: '14:22:05', activeSessions: 4, topEvent: 'CPU' },
    { second: '14:22:10', activeSessions: 6, topEvent: 'db file sequential read' },
    { second: '14:22:15', activeSessions: 22, topEvent: 'enq: TX - row lock contention' },
    { second: '14:22:20', activeSessions: 54, topEvent: 'enq: TX - row lock contention' },
    { second: '14:22:25', activeSessions: 68, topEvent: 'enq: TX - row lock contention' },
    { second: '14:22:30', activeSessions: 65, topEvent: 'enq: TX - row lock contention' },
    { second: '14:22:35', activeSessions: 48, topEvent: 'enq: TX - row lock contention' },
    { second: '14:22:40', activeSessions: 24, topEvent: 'enq: TX - row lock contention' },
    { second: '14:22:45', activeSessions: 8, topEvent: 'CPU' },
    { second: '14:22:50', activeSessions: 3, topEvent: 'CPU' }
  ],
  topWaitEventsInWindow: [
    { event: 'enq: TX - row lock contention', count: 1240, pctActivity: '67.4%' },
    { event: 'CPU + CPU Wait', count: 320, pctActivity: '17.4%' },
    { event: 'db file scattered read', count: 180, pctActivity: '9.8%' },
    { event: 'log file sync', count: 100, pctActivity: '5.4%' }
  ],
  topBlockingSessions: [
    {
      blockingSid: 142,
      serialNum: 38921,
      program: 'JDBC Thin Client (PaiementService)',
      sqlId: '9xk21a50pbvm9',
      blockedSessionsCount: 46,
      actionRequired: 'Session bloquante identifiée ! A laissé une transaction ouverte sur la table INVENTORY.'
    }
  ]
};
