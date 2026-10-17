# 🚀 Oracle Database Tuning Master — AWR & ASH Deep-Dive

> **Plateforme Pédagogique & Interactive 3D d'Optimisation de Bases de Données Oracle 19c / 21c**  
> Présentation de Soutenance (10 Minutes) — Module d'Optimisation SGBD.

---

## 🎯 Objectif du Projet

Ce projet a été conçu pour délivrer une **présentation inoubliable ("WoW Effect")** devant le professeur et les étudiants sur le diagnostic et l'optimisation des performances sous Oracle Database, en se focalisant sur les deux outils rois du **Diagnostic Pack** :
1. **AWR (Automatic Workload Repository)** — La boîte noire macroscopique (snapshots horaires, rétention 8 jours dans `SYSAUX`).
2. **ASH (Active Session History)** — Le microscope temporel (échantillonnage à la seconde dans la `SGA`, capture des micro-pics de 30 secondes).

---

## 🌟 Fonctionnalités Majeures

### 1. ⏱️ Mode Présentation Chronométrée (10 Minutes)
- **Minuteur interactif** décompté avec alertes d'avancement.
- **5 diapositives synchronisées** :
  - `Min 00:00 - 02:00` : **Fondations & Architecture Interne** (SGA, Buffer Cache, Shared Pool, Redo Log, processus MMON/MMNL, et la formule maîtresse : `DB Time = CPU Time + Wait Time`).
  - `Min 02:00 - 04:00` : **AWR Décrypté** (Snapshots, Load Profile, Top 10 Foreground Events, Advisories de dimensionnement).
  - `Min 04:00 - 06:00` : **ASH Le Microscope** (Échantillonnage 1s de `V$ACTIVE_SESSION_HISTORY`, déchargement 1/10 vers `DBA_HIST`, résolution du problème de lissage).
  - `Min 06:00 - 08:00` : **Diagnostics Réels & Top Wait Events** (`db file scattered read`, `log file sync`, `latch contention`, verrous `enq: TX`).
  - `Min 08:00 - 10:00` : **Démo TP Live & Spécificités Windows** (Génération en direct des rapports, `oracle.exe` multi-threadé, Alert Log ADR).
- **Prompteur Orateur intégré** : Le texte exact à prononcer mot pour mot pour chaque diapo afin de convaincre le jury.

### 2. 🧊 Instance Oracle 3D Interactive (WebGL / Three.js)
- Visualisation 3D temps réel de la **System Global Area (SGA)** :
  - Database Buffer Cache
  - Shared Pool (Library Cache & Data Dictionary)
  - Tampon circulaire ASH (1s sampling)
  - Redo Log Buffer
- Processus d'arrière-plan animés : **MMON**, **MMNL**, **LGWR**, **DBWR**.
- Stockage physique : Tablespace **SYSAUX** (référentiel AWR) et Datafiles.
- Animation du flux des sessions et de la capture des wait states.
- Inspecteur d'architecture : cliquez sur un composant 3D pour voir son rôle, ses vues Oracle et ses règles de dimensionnement.

### 3. 📄 Explorateur Interactif de Rapports AWR & ASH Réels
- Analyse d'un cas d'incident de production réel.
- Bascule fluide entre le rapport **AWR (60 min)** et le rapport **ASH (60 sec)**.
- Tableaux interactifs cliquables avec **Doctor DBA Analysis** :
  - *Load Profile* : Logical Reads, Physical Reads, Commits/sec, Hard Parses.
  - *Instance Efficiency* : Buffer Hit %, Execute to Parse %, Soft Parse %.
  - *Top 10 Foreground Events* : Explication médicale du goulot d'étranglement.
  - *ASH Timeline* : Graphique montrant le pic invisible dans AWR et la session bloquante identifiée (`BLOCKING_SESSION = 142`).

### 4. 💻 Simulateur de TP SQL*Plus Live (En direct devant la classe)
- Terminal SQL*Plus interactif pour exécuter les commandes en direct :
  - `SHOW PARAMETER STATISTICS_LEVEL;`
  - `EXEC DBMS_WORKLOAD_REPOSITORY.CREATE_SNAPSHOT();`
  - `@?/rdbms/admin/awrrpt.sql` (génération guidée HTML)
  - `@?/rdbms/admin/ashrpt.sql` (ciblage de la fenêtre critique)
  - Requêtes directes sur `V$ACTIVE_SESSION_HISTORY`
- Bouton interactif pour ouvrir le rapport HTML généré.

### 5. 🎮 Jeu Mini-Simulation : Oracle DBA Hero (5 Urgences Réelles)
- Résolvez 5 incidents majeurs de production :
  1. *Le Pic Mystère de 45 secondes au Checkout* (AWR aveugle vs ASH précis)
  2. *Tempête de Full Table Scans sur l'ERP* (db file scattered read)
  3. *Hard Parse Catastrophe & CPU à 99%* (Bind variables & cursor_sharing)
  4. *Goulot Redo Log & Commits en boucle* (log file sync)
  5. *Buffer Cache Starvation & Advisory Statistics* (Dimensionnement SGA)
- Feedback technique immédiat, calcul de score /100 et confettis de victoire.

### 6. 🪟 Guide d'Inspection Oracle sous Windows
- Architecture `oracle.exe` à processus unique multi-threadé sous Windows (vs modèle multi-processus Linux).
- Emplacement et rôle des fichiers clés :
  - Alert Log dans l'ADR : `%ORACLE_BASE%\diag\rdbms\<db>\<SID>\trace\alert_<SID>.log`
  - Fichier de paramètres : `%ORACLE_HOME%\database\SPFILE<SID>.ORA`
  - Résolution réseau : `listener.ora` et `tnsnames.ora`
  - Services Windows : `OracleService<SID>` et `Oracle<Home>TNSListener`
- Simulateur d'Alert Log avec recherche et commandes PowerShell prêtes à l'emploi.

### 7. 🎓 Questions Pièges du Professeur & Réponses d'Expert
- Préparation aux questions les plus pointues du jury :
  - Différence entre DB Time et Elapsed Time.
  - Pourquoi ASH prend 1 échantillon sur 10 vers `DBA_HIST`.
  - Le mythe du Buffer Cache Hit Ratio à 99%.
  - Licences requises (Diagnostic Pack).
  - Différences fondamentales Windows vs Linux.

---

## 🛠️ Stack Technique

- **Framework** : [Next.js](https://nextjs.org/) (App Router, React 19, TypeScript)
- **Styles & Design** : [Tailwind CSS v4](https://tailwindcss.com/)
- **Moteur 3D** : [Three.js](https://threejs.org/) (WebGL Canvas)
- **Icônes** : [Lucide React](https://lucide.dev/)
- **Audio Interactif** : Web Audio API (effets sonores synthétisés natifs sans dépendances externes)
- **Animations & Victoire** : Canvas-Confetti

---

## 🚀 Démarrage Rapide en Local

```bash
# 1. Cloner le dépôt
git clone https://github.com/moadms/oracle-tuning-awr-ash.git

# 2. Installer les dépendances
npm install

# 3. Lancer le serveur de développement
npm run dev

# 4. Ouvrir dans votre navigateur
http://localhost:3000
```

---

## 🌐 Déploiement sur Vercel

1. Rendez-vous sur [vercel.com](https://vercel.com).
2. Cliquez sur **"Add New Project"** puis **"Import Git Repository"**.
3. Sélectionnez le dépôt `oracle-tuning-awr-ash` de votre compte GitHub **@moadms**.
4. Laissez les réglages par défaut de Next.js (Framework Preset: Next.js).
5. Cliquez sur **Deploy** ! L'application sera accessible mondialement en moins de 60 secondes.

---

## 👨‍💻 Auteur

- **Moad** ([@moadms](https://github.com/moadms))
- Projet pour le module d'**Optimisation des Bases de Données (Oracle Database)**.
