# Le projet à réaliser

- [Composition du groupe](#composition-du-groupe)
- [Rôles](#rôles)
- [Choix de projet](#choix-de-projet)
- [Architecture projet](#architecture-projet)
- [Structure du monorepo](#structure-du-monorepo)
- [Git](#git)
- [Linter obligatoire](#linter-obligatoire)
- [Objectifs techniques](#objectifs-techniques)
- [Notes importantes](#notes-importantes-)

---

## Composition du groupe

### Nombre de membres

**4 à 5 personnes** (sauf accord).

### Équilibre

Le travail en équipe est indispensable, la composition du groupe devra donc être équilibrée :

- les plus expérimentés doivent apprendre à gérer, manager et conseiller les débutants ;
- les débutants doivent apprendre des plus expérimentés ;
- le groupe doit posséder des personnes rigoureuses et organisées ;
- en fonction de son niveau général, le groupe doit avoir des ambitions de projets à la hauteur de ses compétences ;
- le groupe doit contenir des membres plus à l'aise côté front, plus à l'aise côté back, et des personnes possédant des compétences transverses ;
- le groupe doit contenir au moins un membre capable de mettre en ligne le projet et avec des compétences DevOps ;
- le groupe doit contenir au moins un membre capable de recul critique d'un point de vue interface, design, UX et ergonomie ;
- le groupe doit contenir au moins un membre type « architecte » qui sera capable de définir l'architecture idéale pour le projet.

---

## Rôles

Au début du projet, définissez les rôles des membres de vos équipes.

### Rôles organisationnels

- **1× Product Owner** → le responsable produit. C'est lui qui est référent et qui tranche sur les fonctionnalités et priorités, qui rédige les Epics et les User Stories. Il est également testeur et fait les recettes de l'applicatif, afin de s'assurer que tout est comme il l'a défini.
- **1× Scrum Master** → également chef de projet MOE. Responsable de la bonne organisation des équipes et du bon déroulement des points hebdomadaires. Il gère les imprévus et s'assure de la productivité et de la coopération de tout le monde.

### Rôles opérationnels

- **1× Référent DevSecOps** → met en place l'infrastructure, l'hébergement, l'intégration et le déploiement continus. Responsable de la sécurité du projet, y compris au sein du développement.
- **1× Référent Technique** → l'architecte du projet, capable d'orienter techniquement les équipes et de leur apporter des connaissances techniques.
- **1× Référent UX/UI** → vision graphique / artistique / ergonomique. Réalise les maquettes ou est force de proposition sur les bibliothèques graphiques et de composants. Il s'assure que l'interface soit naviguable, claire et utilisable.
- **X× Développeurs Back** _(optionnel, à éviter)_
- **X× Développeurs Front** _(optionnel, à éviter)_
- **X× Développeurs FullStack** _(à privilégier)_

### Points d'attention

- On peut avoir plusieurs casquettes différentes.
- On ne peut **pas** être PO et Scrum Master à la fois.
- Peu importe le rôle principal, **tout le monde doit également être développeur** (Front, Back ou FullStack).
- Le Product Owner s'occupe de la recette fonctionnelle et vérifie que tout correspond à sa vision. **Il n'est pas là pour reporter les bugs** : c'est aux développeurs de s'assurer que le développement fourni est exempt de bugs.

---

## Choix de projet

### Thème libre

Le thème de votre application est **libre**, et sera validé lors de la première séance.

Afin de trouver des idées, prenez en compte les points suivants :

1. L'**objectif cette année sera la qualité** plutôt que la quantité de fonctionnalités.
2. La partie **UI/UX du front ne sera pas importante**, afin de se concentrer sur la qualité du code et sur les web-services. _(En cas de projet commun avec le module FullStack, la partie Front sera spécifiée dans le programme du module FullStack.)_
3. Des **tâches asynchrones** devront être mises en place via un système de Jobs : traitements d'import / export, envoi de notifications ou mails, calculs complexes et longs, génération de rapports, synchronisations, etc.
4. L'**API devra communiquer avec a minima un micro-service dédié** pour un sous-ensemble spécifique de votre application.

> Vérifiez que votre idée de projet sera compatible avec ces points.

---

## Architecture projet

### Séparation front / back, micro-services

Sur ce type d'architecture, on aura plusieurs composantes qui communiqueront entre elles :

- Un ou plusieurs **front-end** (ex : application mobile, frontoffice, backoffice…)
- Un ou plusieurs **back-end** (ex : API, tâches planifiées…)

Pour votre projet, vous aurez **a minima quatre applications** :

- Une **API**
- Un **job-runner**
- Au moins un **micro-service** dédié pour un ensemble de fonctionnalités spécifiques à votre projet
- Un **frontend** (appli mobile ou web)

### Frameworks imposés

| Côté | Technologie |
| --- | --- |
| **Back** | **NestJS** _(autre techno possible pour un service secondaire, avec justification, et sur validation)_ |
| **Front** | **React** ou **React Native + Expo** |

### Gestionnaire de paquet

- **PNPM**
- ou **YARN**

> Afin de simplifier la gestion du monorepo.

---

## Structure du monorepo

Utilisez **PNPM workspaces** ou **Yarn workspaces**.

```text
└── my-project/
    ├── .github/
    ├── apps/
    │   ├── api/
    │   │   ├── src/
    │   │   │   └── index.ts
    │   │   ├── package.json
    │   │   └── ...
    │   └── front/
    │       └── ...
    ├── docs/
    │   ├── xxx.md
    │   └── ...
    ├── packages/
    │   ├── eslint/
    │   ├── tsconfig/
    │   ├── schemas/
    │   ├── ui/
    │   ├── utils/
    │   └── ...
    ├── .dockerignore
    ├── .gitignore
    ├── .npmrc
    ├── Dockerfile
    ├── docker-compose.yml
    ├── package.json
    └── README.md
```

### Règles de structure

1. **`apps/`** → vos différents applicatifs lançables dans une instance.
   _Exemples_ : `app`, `front`, `backoffice`, `admin`, `api`, `worker`, `job-runner`, `proxy`, `gateway`…
2. **`packages/`** → dépendances écrites par vous-même, communes entre plusieurs projets (par exemple des schémas Zod). La configuration ESLint et TSConfig doit résider ici.
   _Exemples_ : `eslint`, `tsconfig`, `schemas`, `ui`, `utils`, `orm`…
3. **`docs/`** → la documentation de votre projet, au plus proche de votre code.
4. Chaque `package` ou `app` possède son propre `package.json` et son propre nom, ex : `@my-project/front` (et éventuellement son propre `tsconfig.json` et `eslint.config.mjs`).
5. Si un package doit être utilisé par une app, installez-le dans l'app en suivant la doc du gestionnaire de paquet.
6. Pour des bundles sans modules dupliqués, préférez les **`peerDependencies`** pour les dépendances de vos `package`, avec `*` en version. Ce sont vos `app` parentes qui porteront les numéros de versions précis.

---

## Git

- **GitHub obligatoire**, deux branches principales : `main` et `develop`.
- L'évaluation sera effectuée sur la branche `main`.
- Seuls des commits de **Pull Request** ou **merge Non Fast Forward (pas de SQUASH)** doivent se trouver sur la branche `main`.

### Convention de commit

> **Important** : le format **`conventional-commit`** doit être utilisé pour le nom des commits.

> ⚠️ **TOUT COMMIT NE RESPECTANT PAS CETTE CONVENTION SERA RETIRÉ DE LA CODEBASE FINALE.**

Exemples :

- `feat(api): add authentication feature (#231)`
- `fix(api/auth): forgotten password mail not working (#245)`

### Participation

- Tous les membres doivent **participer au développement** et effectuer des commits **réguliers** et **équilibrés** (en quantité ou complexité).
- Une **contribution individuelle insuffisante** au projet, non justifiée, sera **lourdement sanctionnée**.
- Préférez **plusieurs petits commits intermédiaires** à un énorme commit.
- Les **Pull Reviews** sont fortement recommandées : les membres expérimentés sont responsables de ce qui est ajouté à la codebase commune.

---

## Linter obligatoire

Un **linter cohérent** (`eslint`) et un **formatter** (`prettier`) sont obligatoires.

- Pour la configuration ESLint, le **nouveau format flat** (plus simple) doit être utilisé.
- Regroupez vos configurations ESLint dans un **`packages/eslint`**.
- Modules à appliquer : `perfectionist`, `sonarjs`, `stylistic`, `typescript`, `unicorn`, `react`, `react-hooks`.
- Votre module `packages/eslint` peut exposer deux configurations : `react.js` et `nest.js`, qui héritent d'un `base.js` et permettent de gérer les cas spécifiques.

---

## Objectifs techniques

1. **Scalabilité** : votre application doit résister à la charge et fonctionner sur plusieurs instances sans qu'elles n'entrent en conflit.
   - Privilégiez les **JWT** pour les tokens d'accès.
   - Attention aux tâches, jobs et cron qui ne doivent pas rentrer en conflit entre instances.
   - Il faudra absolument **montrer un système fonctionnel avec plusieurs instances (réplicas)**.

2. **Qualité** : code conçu avec une **nomenclature commune**, tout développeur doit pouvoir restituer un code similaire (les code reviews permettent de vérifier cela). Les Linters correctement configurés garantissent le respect des règles.

3. Votre application devra disposer de :
   1. Une **base de données principale**, optimisée avec des index cohérents, idéalement avec scalabilité en tête.
   2. Une **API** avec de la logique métier, documentée a minima par un **Swagger**, qui permet à tout développeur de développer un client facilement (aujourd'hui une appli Web, demain potentiellement mobile).
   3. Un **job runner** pour les tâches asynchrones (utilisez **BullMQ**), idéalement configuré par variables d'environnement pour différencier les types de tâches sur différentes instances.
   4. Un **front** (interface utilisateur). **Aucune valorisation sur l'UX/UI** : c'est la qualité du code, le découpage des composants, l'aspect Pure et les bonnes pratiques qui comptent.
   5. Un **Redis** pour : la scalabilité (données partagées entre instances), les jobs, la mise en cache de données référentielles, le temps réel (pub/sub), la gestion d'invalidation de jetons d'authentification.

4. **Langages, frameworks et technologies imposés** :
   1. **React** ou **React Native** en front.
   2. **NestJS** en back.
   3. Code en **TypeScript**, mode `strict`, `noImplicitAny` et `noImplicitNull`. L'utilisation de `any` doit être explicitement justifiée par un commentaire.
   4. Technos supplémentaires possibles pour vos communications : **WebSocket**, **gRPC**, **tRPC**.

5. Une **couverture de tests automatisés** est demandée :
   1. Couverture **Front**.
   2. Couverture **Back**.
   3. ⚠️ **Tout ne doit pas être testé** ! Utilisez les commentaires permettant d'indiquer explicitement ce qui ne doit pas être testé, afin de ne pas descendre votre coverage.

6. Attention particulière à la **sécurité** :
   1. Sécurisation des accès aux routes selon des **rôles**.
   2. Éviter les failles communes : **SQLi**, **XSS**…

7. Système d'**authentification et de gestion de rôles** demandé.

8. Configuration **`docker-compose` fonctionnelle** demandée. Un script d'initialisation de base de données doit être automatiquement exécuté au premier lancement (conseil : cf. images **Bitnami** pour les bases).

---

## Notes importantes !!

1. En **10 séances**, tout n'est pas réalisable. La **gestion de projet** et **des priorités** est indispensable.
2. **Qualité du code, architecture et bonnes pratiques** > quantité de fonctionnalités.
3. **Étudiez bien la grille d'évaluation et les coefficients** pour faire les choix de sacrifices si nécessaires.
4. Votre **niveau d'expertise doit se refléter dans vos choix**. Incluez des **parties challenge-antes** présentables en soutenance.
5. Développez le **cœur de votre applicatif** (ce qui répond à votre problématique initiale) **en premier**. Ne vous écartez pas de vos priorités.
6. **Préparez bien les points** que vous présenterez en soutenance, ainsi que les **justifications et explications de vos choix**.
