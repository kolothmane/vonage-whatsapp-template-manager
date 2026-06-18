# Vonage WhatsApp Template Manager

Plateforme d'entreprise permettant de gérer, valider, transformer, prévisualiser et importer massivement des templates WhatsApp dans plusieurs WhatsApp Business Accounts (WABAs) connectés à Vonage.

Production : [vonage-whatsapp-template-manager.vercel.app](https://vonage-whatsapp-template-manager.vercel.app)

## Objectif

L'application sécurise toute la chaîne de gestion des templates :

```text
Fichier source
  -> Lecture
  -> Validation
  -> Transformation
  -> Détection des doublons
  -> Prévisualisation
  -> Génération JSON
  -> Envoi vers Vonage
  -> Suivi et audit
```

Elle est conçue pour supporter :

- des centaines de WABAs ;
- plusieurs milliers de templates ;
- plusieurs marques et langues ;
- des imports CSV, XLSX et JSON ;
- une gouvernance stricte des doublons ;
- la reprise des traitements en échec ;
- une traçabilité complète.

## Architecture

```text
Navigateur
   |
Interface Next.js / React
   |
API Next.js
   |
Services métier TypeScript
   |
PostgreSQL + Redis + API Vonage
```

### Frontend

- **Next.js 15** : App Router, rendu serveur et routes applicatives.
- **React 19** : composants interactifs.
- **TypeScript** : typage strict des données métier et des API.
- **Tailwind CSS** : interface responsive inspirée du design Vonage.
- **TanStack Table** : recherche, tri, pagination et affichage des tables.
- **Zod** : validation structurée des entrées.
- **Recharts** : visualisation des données réelles du dashboard.

### Backend

Le backend repose sur les Route Handlers Next.js et des services TypeScript modulaires.

Il prend en charge :

- la récupération des WABAs ;
- la récupération, création et suppression de templates ;
- la validation des imports ;
- la génération de payloads Vonage ;
- la synchronisation des templates ;
- la gestion des retries ;
- l'accès aux logs et à l'historique.

### Stockage

**PostgreSQL** conserve :

- les utilisateurs et sessions ;
- les WABAs ;
- les templates et leurs versions ;
- les imports et éléments d'import ;
- les correspondances de variables ;
- les logs techniques ;
- les audits métier ;
- les paramètres.

**Prisma** fournit une couche d'accès typée à PostgreSQL. Le schéma complet se trouve dans [`prisma/schema.prisma`](prisma/schema.prisma).

### Traitement asynchrone

**Redis** et **BullMQ** sont utilisés pour traiter les imports volumineux en arrière-plan.

Ils permettent :

- le traitement par lots ;
- l'exécution parallèle contrôlée ;
- le respect des limites de l'API Vonage ;
- le suivi de progression ;
- les tentatives automatiques ;
- la reprise après redémarrage.

## Assistant d'import

L'import est organisé en six étapes.

### 1. Upload

L'utilisateur fournit un fichier :

- CSV ;
- XLSX ;
- JSON.

Les principales colonnes attendues sont :

```text
BRAND
Language
Template
Template Name
Template Body
Body Variables
Body Parameters
Template Type
Automation
```

Le fichier est lu dans le navigateur et transformé en lignes structurées. Aucun envoi vers Vonage n'a lieu pendant cette étape.

### 2. Prévisualisation

Les données importées sont affichées avant traitement afin de vérifier :

- la structure du fichier ;
- la reconnaissance des colonnes ;
- l'encodage ;
- les valeurs ;
- les WABAs sélectionnés comme cibles.

### 3. Validation

Le moteur vérifie :

- la présence des colonnes obligatoires ;
- les champs vides ;
- la marque ;
- la langue ;
- le nom du template ;
- le corps du message ;
- la catégorie ;
- la longueur du contenu ;
- les placeholders ;
- les doublons.

Marques prises en charge :

```text
AB
AD
BNT
CH
CLB
```

Langues prises en charge :

```text
EN -> en
FR -> fr
ES -> es
PT -> pt
IT -> it
DE -> de
```

Catégories acceptées :

```text
MARKETING
UTILITY
AUTHENTICATION
```

Chaque anomalie possède une sévérité :

- `INFO`
- `WARNING`
- `ERROR`

En mode strict, la présence d'une erreur bloque la soumission.

## Génération des noms

Les noms techniques sont normalisés de manière déterministe.

Exemple :

```text
Nom original : (W) Beauty - Product Available
Langue       : DE
Résultat     : w_beauty_product_available_de
```

Le moteur :

1. convertit le texte en minuscules ;
2. retire les accents ;
3. retire les caractères spéciaux ;
4. remplace les espaces par `_` ;
5. fusionne les séparateurs consécutifs ;
6. ajoute le suffixe de langue.

Le système n'ajoute jamais automatiquement :

```text
_v2
_copy
timestamp
chaîne aléatoire
```

## Normalisation des variables

Plusieurs syntaxes métier sont reconnues :

```text
[FIRST NAME]
[STORE NAME]
{{1}}
{{{Sender.FirstName}}}
{{{Account.Name}}}
{!User.FirstName}
```

Exemple :

```text
Hello [FIRST NAME], welcome to [STORE NAME]
```

devient :

```text
Hello {{1}}, welcome to {{2}}
```

Une correspondance est également produite :

```text
{{1}} -> FIRST_NAME
{{2}} -> STORE_NAME
```

Ces correspondances peuvent ensuite être enregistrées en base.

## Détection des doublons

La règle est :

```text
Même WABA + même nom généré = doublon
```

Avant toute soumission, le moteur compare les templates du lot avec ceux qui existent déjà dans chaque WABA cible.

Il recherche également les doublons internes au fichier importé.

Lorsqu'un doublon est trouvé :

- une erreur `DUPLICATE_TEMPLATE` est produite ;
- la soumission est bloquée en mode strict ;
- aucun renommage automatique n'est appliqué ;
- aucun template existant n'est écrasé ou fusionné.

## Génération du payload Vonage

Après transformation, l'application génère un payload compatible avec le service Vonage.

Exemple simplifié :

```json
{
  "name": "welcome_client_fr",
  "language": "fr",
  "category": "UTILITY",
  "components": [
    {
      "type": "BODY",
      "text": "Bonjour {{1}}, votre commande est disponible."
    }
  ],
  "metadata": {
    "brand": "AB",
    "automation": "Order Ready",
    "variable_mappings": [
      {
        "placeholder": "{{1}}",
        "key": "FIRST_NAME",
        "source": "[FIRST NAME]"
      }
    ]
  }
}
```

L'utilisateur peut :

- prévisualiser le JSON ;
- le copier ;
- le télécharger ;
- exporter un template ou un lot.

## Modes de soumission

### Mode strict

Mode par défaut. Toute erreur bloquante empêche la soumission :

- doublon ;
- langue invalide ;
- colonne absente ;
- placeholder incorrect ;
- catégorie invalide ;
- nom non conforme.

### Mode relaxé

Les avertissements peuvent être acceptés après validation explicite. Les erreurs bloquantes restent refusées.

## Queue et retries

Un import volumineux est découpé en jobs BullMQ :

```text
Import
  -> Lots
  -> Jobs BullMQ
  -> Workers
  -> API Vonage
```

Les paramètres contrôlables comprennent :

- la taille des lots ;
- la concurrence ;
- la limite d'appels ;
- le nombre de tentatives ;
- le délai exponentiel entre les tentatives.

Les retries peuvent viser :

- un template ;
- un lot ;
- tous les éléments en échec.

## Logs et audit

### Logs techniques

Ils peuvent contenir :

- l'identifiant d'import ;
- le WABA ;
- le template ;
- la marque ;
- la langue ;
- le payload ;
- la réponse ;
- l'erreur ;
- le statut ;
- l'horodatage.

Statuts possibles :

```text
Pending
Submitted
Approved
Rejected
Failed
Skipped
```

### Audit métier

L'audit enregistre :

- l'utilisateur ;
- l'action ;
- la date ;
- l'ancienne valeur ;
- la nouvelle valeur.

Les actions suivies comprennent la création, la modification, la suppression, la soumission et le retry.

## Sécurité

L'architecture prévoit :

- une authentification JWT ;
- l'expiration des sessions ;
- le hachage bcrypt des mots de passe ;
- un contrôle RBAC ;
- la validation systématique des entrées ;
- le masquage des secrets ;
- la vérification des autorisations dans les API.

Rôles prévus :

- **Admin** : accès complet ;
- **Operator** : gestion des imports ;
- **Viewer** : lecture seule.

Les identifiants Vonage ne sont jamais envoyés au navigateur.

## Absence de données factices

L'application n'injecte aucune donnée de démonstration.

Sans `DATABASE_URL`, les services retournent des collections vides :

```text
WABAs     : 0
Templates : 0
Imports   : 0
Logs      : 0
```

L'interface affiche des états vides jusqu'à la connexion des services réels.

## Variables d'environnement

Créer un fichier `.env` ou configurer les variables dans Vercel :

```env
VONAGE_API_KEY=
VONAGE_API_SECRET=
VONAGE_APPLICATION_ID=
VONAGE_PRIVATE_KEY=

DATABASE_URL=
REDIS_URL=
JWT_SECRET=

IMPORT_BATCH_SIZE=
IMPORT_CONCURRENCY=
IMPORT_RATE_LIMIT_PER_MINUTE=
```

Le fichier [`.env.example`](.env.example) fournit la liste complète sans secret.

## Installation locale

Prérequis :

- Node.js 20.9 ou supérieur ;
- PostgreSQL ;
- Redis.

Installation :

```bash
npm install
npm run prisma:generate
```

Démarrer PostgreSQL et Redis avec Docker :

```bash
docker compose up -d postgres redis
```

Créer les tables :

```bash
npm run prisma:migrate
```

Démarrer l'application :

```bash
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

## Tests et qualité

```bash
npm run test
npm run lint
npm run build
```

Les tests couvrent notamment :

- la génération des noms ;
- la suppression des accents ;
- les suffixes de langue ;
- la normalisation des variables ;
- le rejet des langues non supportées ;
- le blocage des doublons.

## Docker

Lancer l'ensemble de la stack :

```bash
docker compose up --build
```

Les services comprennent :

- l'application Next.js ;
- PostgreSQL ;
- Redis.

## Déploiement Vercel

Le projet est compatible avec Vercel :

```bash
vercel deploy --prod
```

Après l'ajout ou la modification des variables d'environnement, déclencher un nouveau déploiement pour les injecter dans le runtime.

## Structure principale

```text
src/
  app/
    api/                  Routes API Next.js
    import/               Assistant d'import
    templates/            Gestion des templates
    wabas/                Gestion des WABAs
    imports/              Historique des imports
    logs/                 Logs techniques
    history/              Audit
    settings/             Configuration
  components/             Composants React et UI
  lib/
    domain/               Règles métier
    server/               Base, queue, auth et Vonage

prisma/
  schema.prisma           Modèle PostgreSQL

tests/
  unit/                   Tests Vitest

examples/                 Exemples CSV, XLSX et JSON
docs/                     API, installation et schéma SQL
```

## Documentation complémentaire

- [Guide d'installation](docs/INSTALLATION.md)
- [Documentation API](docs/API.md)
- [Schéma PostgreSQL](docs/postgresql-schema.sql)

## Licence

Projet interne. Ajouter une licence explicite avant toute distribution publique.
