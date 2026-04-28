# SETUP — Outils IA pour collaborer sur ce projet

> Pré-requis **agents IA** uniquement. Pour la stack technique du projet (Node, pnpm, Docker, Postgres, Redis…), voir [`CLAUDE.md`](CLAUDE.md) §2 et le futur `README.md`.

Ce projet est conçu pour être développé **assisté par agents IA** (Cursor + Claude Code / Codex). Pour que tout le monde travaille avec les mêmes garde-fous, deux skills doivent être installées **une fois pour toutes** sur chaque poste :

| Skill | Rôle | Source |
|---|---|---|
| **superpowers** | Workflow complet : brainstorming → spec → plan → TDD → revue → merge. C'est ce qui produit les fichiers dans `docs/superpowers/specs/` et `docs/backlog/`. | Plugin Cursor (`obra/superpowers`) |
| **impeccable** | Vocabulaire et garde-fous design pour le front (typo, couleur, espacement, anti-patterns). Évite les outputs IA génériques (Inter + dégradé violet + cards-dans-cards). | Skill npm (`pbakaus/impeccable`) |

> Les deux sont **à installer en global** (utilisateur), pas dans le repo. Elles ne sont donc pas committées : ce fichier sert de mode d'emploi.

---

## 1. Cursor

### 1.1 Installer Cursor

Télécharger depuis [cursor.com/download](https://cursor.com/download).

### 1.2 Passer sur le canal Nightly

Les Agent Skills ne sont disponibles que sur le canal **Nightly** :

1. `Cursor → Settings → Beta`
2. Sélectionner **Nightly**
3. Redémarrer Cursor (il se met à jour tout seul)

### 1.3 Activer les Agent Skills

1. `Cursor → Settings → Rules`
2. Cocher **Agent Skills**
3. Redémarrer Cursor

### 1.4 Vérifier

Dans un chat agent Cursor, taper `/` — tu dois voir une commande `/skills` ou équivalent. Si non, recommencer §1.2 / §1.3.

---

## 2. Superpowers (workflow & specs)

### 2.1 Installation

Dans un **chat agent Cursor** (n'importe quel projet), taper :

```text
/add-plugin superpowers
```

Sinon, via la palette de plugins : `Settings → Plugins → Marketplace → "superpowers"`.

### 2.2 Ce que tu obtiens

14 skills qui se déclenchent automatiquement quand pertinent — notamment :

- `brainstorming` — exploration d'intention avant tout code
- `writing-plans` — plan d'implémentation à partir d'une spec
- `executing-plans` — exécution checkpointée d'un plan
- `test-driven-development` — TDD strict (red / green / refactor)
- `systematic-debugging` — protocole de debug avec preuves
- `requesting-code-review` / `receiving-code-review`
- `using-git-worktrees`, `dispatching-parallel-agents`, `subagent-driven-development`
- `verification-before-completion` — interdit de dire "c'est fini" sans preuve
- `finishing-a-development-branch` — fin de branche (merge, PR, cleanup)

> **Sur ce projet précis**, les specs produites par `writing-plans` doivent être déposées dans `docs/superpowers/specs/` (cf. [`CLAUDE.md`](CLAUDE.md) §8) et les plans/tickets dans `docs/backlog/`.

### 2.3 Mise à jour

Dans un chat agent Cursor :

```text
/update-plugin superpowers
```

---

## 3. Impeccable (design front)

### 3.1 Pré-requis

- **Node.js ≥ 20** (`node --version`)
- **npm ≥ 10** (livré avec Node)

### 3.2 Installation globale

Dans un terminal **n'importe où** (pas besoin d'être dans le projet) :

```powershell
# Windows / PowerShell
npx skills add pbakaus/impeccable -y -g -a cursor --copy
```

```bash
# macOS / Linux
npx skills add pbakaus/impeccable -y -g -a cursor --copy
```

La skill est installée dans `~/.agents/skills/impeccable/`. Pour que **Cursor** la voie, copier aussi vers `~/.cursor/skills/` :

```powershell
# Windows / PowerShell
$dst = Join-Path $HOME ".cursor\skills\impeccable"
if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }
New-Item -ItemType Directory -Path (Split-Path $dst) -Force | Out-Null
Copy-Item -Recurse -Force (Join-Path $HOME ".agents\skills\impeccable") $dst
```

```bash
# macOS / Linux
mkdir -p ~/.cursor/skills
rm -rf ~/.cursor/skills/impeccable
cp -r ~/.agents/skills/impeccable ~/.cursor/skills/impeccable
```

### 3.3 Ce que tu obtiens

Une commande `/impeccable` avec 23 sous-commandes — les plus utiles ici :

- `/impeccable teach` — **à lancer une fois sur le projet** : génère `PRODUCT.md` et `DESIGN.md` à la racine, qui servent ensuite de mémoire design partagée.
- `/impeccable craft <description>` — flow complet shape → build avec itération visuelle
- `/impeccable audit <zone>` — audit a11y, perf, responsive
- `/impeccable critique <zone>` — revue UX (hiérarchie, clarté)
- `/impeccable polish <zone>` — passe finale avant merge

> ⚠️ Sur ce projet, l'UI/UX **n'est pas valorisée** (cf. [`docs/consignes/projet.md`](docs/consignes/projet.md) §4.4). Impeccable reste utile pour **éviter les régressions a11y** et garder un front propre, **pas** pour rajouter du flair.

### 3.4 Mise à jour

```powershell
npx skills update -g
# puis re-copier vers ~/.cursor/skills/impeccable comme en §3.2
```

### 3.5 Désinstallation

```powershell
npx skills remove impeccable -g -y
Remove-Item -Recurse -Force "$HOME\.cursor\skills\impeccable"
```

---

## 4. Vérification rapide

Une fois les §1, §2, §3 faits, ouvrir Cursor sur ce projet et lancer un nouveau chat agent :

```text
/impeccable
```

→ tu dois voir la liste des 23 commandes Impeccable. Si oui, tout est OK.

```text
List your active skills.
```

→ l'agent doit mentionner au minimum `superpowers` (avec ses sous-skills brainstorming, writing-plans, etc.) et `impeccable`.

---

## 5. FAQ

**Faut-il committer quelque chose ?**
Non. Les deux skills sont installées au niveau utilisateur (`~/.agents/`, `~/.cursor/skills/`). Elles ne touchent pas au repo. Seul ce `SETUP.md` est versionné.

**Et si je n'utilise pas Cursor ?**
- Claude Code → installer Superpowers via `/plugin install superpowers@claude-plugins-official`. Impeccable se met dans `~/.claude/skills/impeccable/` (`npx skills add pbakaus/impeccable -y -g -a claude-code --copy`).
- Codex CLI → suivre [`https://raw.githubusercontent.com/obra/superpowers/refs/heads/main/.codex/INSTALL.md`](https://raw.githubusercontent.com/obra/superpowers/refs/heads/main/.codex/INSTALL.md). Impeccable est déjà au bon endroit (`~/.agents/skills/impeccable/`).
- Autres harnesses (Gemini CLI, OpenCode…) → voir READMEs respectifs des deux projets.

**Je vois `[rtk] /!\ No hook installed` quand je lance npx.**
C'est un wrapper local sans rapport avec ce projet. Inoffensif. Ignorer.

**Les commandes `/impeccable` n'apparaissent pas dans Cursor.**
Vérifier dans l'ordre : (1) canal Nightly actif, (2) Agent Skills cochés dans Settings → Rules, (3) Cursor a été redémarré, (4) `~/.cursor/skills/impeccable/SKILL.md` existe.

---

## 6. Liens

- Impeccable — [github.com/pbakaus/impeccable](https://github.com/pbakaus/impeccable) · [impeccable.style](https://impeccable.style)
- Superpowers — [github.com/obra/superpowers](https://github.com/obra/superpowers)
- Cursor Agent Skills — [docs.cursor.com](https://docs.cursor.com/) (chercher "Skills")
