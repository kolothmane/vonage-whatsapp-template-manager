# Memoire / contexte du projet WABA BR WhatsApp Template Manager

Ce document sert de memoire de travail pour reprendre le projet sans perdre le contexte. Il ne contient pas de secrets en clair, pas de private key, pas de token, et pas de valeur sensible complete. Les identifiants non secrets utiles au diagnostic sont conserves quand ils sont necessaires: application IDs, WABA IDs, noms de credentials VCR, URLs publiques, statuts d'API et conclusions techniques.

## Objectif initial

Le projet est une application web de gestion de templates WhatsApp pour Vonage / WABA.

Objectifs principaux demandes:

- reproduire l'UI du Vonage WhatsApp Template Manager, sans recopier toute la logique Vonage;
- deployer en production sur Vercel, pas en preview;
- permettre l'import de fichiers CSV, XLSX et JSON;
- valider les templates avant soumission;
- stocker les imports/templates dans une base persistante;
- gerer plusieurs environnements Vonage;
- isoler les donnees par utilisateur et par environnement;
- permettre aux admins d'assigner l'acces aux environnements;
- tracer dans les logs qui a fait quoi;
- soumettre ensuite les templates vers les WABAs Vonage.

Application de production:

- URL principale: `https://vonage-whatsapp-template-manager.vercel.app`
- Repository GitHub: `https://github.com/kolothmane/vonage-whatsapp-template-manager`
- Branche cible: `main`

## Stack technique

Le projet est une application Next.js App Router.

Technologies principales:

- Next.js 15
- React 19
- TypeScript
- NextAuth v5 beta pour l'authentification Google
- Prisma pour la structure database
- Upstash Redis / Vercel KV pour la persistance dans l'environnement Vercel actuel
- Vercel pour le hosting production
- Vitest pour les tests unitaires
- API Vonage Channel Manager et WhatsApp Template Management

Le projet utilise actuellement surtout le stockage KV/Redis pour les donnees metier persistantes. Des references Prisma/PostgreSQL existent dans la specification auth/whitelist, mais les variables disponibles cote Vercel ont impose l'utilisation des variables deja presentes, notamment Upstash/KV, sans creer de nouvelle variable `DATABASE_URL`.

## UI et branding

Changements UI realises:

- remplacement de `Vonage APIs` par `WABA BR`;
- suppression du logo;
- suppression de l'utilisateur fictif `Operations Admin`;
- suppression des donnees factices;
- correction de plusieurs problemes de zoom/responsiveness;
- conservation d'une UI proche du Vonage Template Manager;
- sidebar avec sections de gestion, imports, logs, settings;
- page Import Wizard;
- page Template Registry;
- page WABA Management;
- page WABA detail avec templates existants et bouton vers le catalogue/import.

Un probleme de zoom est revenu une fois: l'interface etait trop large et obligeait l'utilisateur a mettre Chrome a 67%. Des corrections CSS/responsive ont ete appliquees.

## Import de templates

Le flux d'import a ete travaille plusieurs fois.

Comportement attendu:

- accepter CSV, XLSX et JSON;
- parser le fichier;
- detecter les erreurs par ligne;
- ne pas inventer de labels de variables;
- si aucun libelle de variable n'est fourni, afficher une erreur;
- ne jamais remplacer automatiquement des labels manquants par `ARG`;
- permettre de submit les lignes valides meme s'il reste des lignes invalides;
- les lignes invalides ne doivent pas etre importees et doivent rester visibles quelque part;
- les templates importes doivent etre retrouvables ensuite dans l'application;
- les imports doivent etre lies a l'environnement actif.

Bugs corriges ou analyses:

- des variables devenaient `ARG`: comportement corrige. Les labels manquants doivent produire une erreur explicite.
- `STRICT MODE` bloquait toute soumission si validation partiellement invalide: comportement ajuste pour permettre la soumission des lignes valides.
- apres soumission dans l'Import Wizard, les templates n'etaient pas visibles ensuite: correction autour de la persistance et de la consultation des imports/templates.
- `fileName, rows and targetWabaIds are required`: logique revue car la soumission d'un import ne doit pas exiger un target WABA des le depart. Le choix du WABA doit intervenir ensuite.
- langue `DU`: l'utilisateur a confirme que la langue existe bien. Ne pas rejeter cette langue par supposition.

Des fichiers d'exemple ont ete utilises pendant le debug:

- `Test Import.xlsx`
- `Test Import.xlsx.vonage.json`
- `test.xlsx`
- `test_corrige.xlsx`

Certains fichiers comportaient des erreurs de placeholders, de noms manquants ou de variables sans libelles. Les erreurs de type `INVALID_PLACEHOLDER`, `INVALID_FIELD`, `MISSING_VARIABLE_LABEL` ont ete analysees.

## Validation et placeholders

Regles importantes:

- ne jamais imaginer un libelle de variable;
- ne jamais generer `ARG` quand le libelle n'est pas fourni;
- signaler explicitement l'erreur;
- permettre a l'utilisateur de modifier manuellement un template invalide;
- permettre la modification aussi sur la page de soumission vers WABA.

Pour les placeholders a la fin d'un template:

Vonage peut refuser un template si une variable est en debut ou fin de body:

```text
Leading or trailing params not allowed
Variables can't be at the start or end of the template.
```

L'utilisateur a trouve qu'ajouter un caractere invisible apres une variable finale permettait l'acceptation. La logique de creation/update Vonage applique donc un marqueur invisible quand necessaire via `ensureVonageTrailingParamMarker`.

Exemple de cas:

```text
Hello {{1}},

...

{{2}}
{{3}}
```

Meta Business pouvait accepter manuellement le template, mais Vonage rejetait l'appel API. La solution implementee est d'ajouter un caractere invisible apres une variable finale dans le payload envoye a Vonage.

## Nomenclature des noms de templates

Regle demandee:

- utiliser `Template Name`, pas `Template Description`;
- normaliser les noms selon une nomenclature canonique.

Exemple:

```text
(W) -Product Available
```

devient:

```text
w_product_available_en
```

La langue est ajoutee dans le nom canonique. Les noms doivent etre coherents entre imports, exports, logs et payloads API.

Point important sur les doublons:

- un meme template name ne doit pas etre considere comme un doublon critique s'il ne concerne pas la meme marque;
- la marque doit entrer dans la logique de detection ou de classification quand elle differencie deux templates.

## Preview WhatsApp

Pour l'affichage final du template dans la preview WhatsApp:

- `First name` doit etre remplace par un prenom exemple, par exemple `Mia`;
- `Sender first name` doit etre remplace par un prenom exemple, par exemple `Ana`;
- `Store name` doit etre remplace par la marque correspondant au template;
- exemple: pour une marque `AB`, le store name affiche doit etre `AB`.

L'objectif est d'avoir une preview lisible et realiste, pas les libelles bruts.

## Template Registry

Demandes implementees ou prises en compte:

- recherche dans les templates;
- tri via menus deroulants;
- filtres par langue;
- filtres par marque;
- possibilite de modifier manuellement un template;
- possibilite de supprimer un template;
- possibilite de supprimer plusieurs templates;
- possibilite de supprimer tous les templates en masse;
- category par defaut: `Marketing`;
- edition accessible aussi sur la page ou on submit les templates.

Un bug a ete signale: cliquer sur `edit` ne faisait rien. Le comportement a ete corrige autour de l'ouverture/interaction d'edition.

## WABA Management

La page WABA Management doit:

- afficher les WABAs de l'environnement actif;
- permettre de choisir un WABA;
- lister les templates deja existants sur ce WABA;
- permettre de modifier les templates existants si l'API le permet;
- avoir un bouton dedie pour acceder a la page ou on choisit les templates charges/importes a soumettre vers ce WABA.

Demande importante:

- quand on ouvre un WABA dans l'outil, afficher d'abord les templates deja existants sur ce WABA;
- le bouton dedie renvoie vers la page/catalogue avec tous les templates charges/importes selectionnables.

WABA IDs cites pendant le projet:

- `110326855406164`
- `148929584978940`
- `2194955841317353`
- `2691621974550235`

Pour `WABA 110326855406164`, l'utilisateur a demande d'afficher le vrai nom Facebook Business au lieu de `WABA 110326855406164`.

Le statut `Action Required` dans l'app signifie que l'API n'a pas renvoye un etat clairement actif/connecte ou que les details sont incomplets. Dans certains cas, ce statut venait du fait que la sync parent WABA ne pouvait pas lire les details via Channel Manager.

## Selection automatique des templates par WABA

Comportement demande:

- permettre a l'utilisateur de selectionner un WABA;
- proposer automatiquement les templates les plus probables pour ce WABA;
- la selection doit etre basee sur la marque et la langue;
- l'utilisateur doit quand meme pouvoir verifier, modifier, selectionner ou deselectionner avant soumission;
- ajout de menus deroulants pour trier/filtrer par langue et marque.

## Logs

Demandes sur les logs:

- ajouter une recherche dans les logs;
- expliquer les statuts comme `pending`;
- afficher le nom de la personne qui a fait l'action, pas seulement le log anonyme;
- conserver une trace de qui a fait quoi;
- pour les anciennes modifications, les associer a `Othmane Tazouti`;
- remplacer `created by nfourmestreaux` par `created by otazouti@baybridgedigital.com`.

Les logs doivent afficher le nom/prenom quand disponible, pas seulement l'email.

## Authentification et securite

Une authentification Google a ete ajoutee.

Regles de login:

- l'utilisateur arrive d'abord sur une page login;
- bouton `Connect with Gmail`;
- Google fournit email, nom et prenom;
- l'email doit etre verifie par Google;
- domaine autorise: `baybridgedigital.com` ou `bayretail.io`;
- si l'email est dans `ADMIN_EMAILS`, login autorise;
- sinon l'email doit exister dans la whitelist persistante;
- sinon refus.

Regles admin:

- `ADMIN_EMAILS` est une variable d'environnement;
- elle contient une ou plusieurs adresses separees par virgules;
- exemple: `admin1@baybridgedigital.com,admin2@bayretail.io`;
- ces emails ne sont pas la whitelist utilisateur;
- seuls ces admins peuvent gerer la whitelist dans Settings;
- seuls ces admins peuvent ajouter/supprimer/modifier les acces;
- les routes API create/delete/update de whitelist doivent verifier la session cote serveur et retourner `403` si l'utilisateur n'est pas admin.

Important:

- la protection ne doit pas etre uniquement front-end;
- les checks serveur sont obligatoires.

Une erreur a ete signalee quand un utilisateur ajoute a la whitelist essayait de se connecter:

```text
Application error: a server-side exception has occurred while loading ...
Digest: 4191260280
```

Le besoin associe:

- quand un admin ajoute un utilisateur, il doit pouvoir lui assigner des environnements dans le meme menu;
- si aucun environnement n'est assigne, afficher une popup claire expliquant que l'utilisateur n'aura pas d'environnement accessible tant qu'un admin ne lui en assigne pas.

## Environnements Vonage

Le fonctionnement a evolue vers des environnements multiples.

Demandes:

- l'utilisateur indique les credentials Vonage sur lesquels il veut travailler;
- les credentials ne doivent pas etre affiches en clair;
- ils doivent etre conserves;
- un utilisateur peut enregistrer plusieurs environnements;
- il peut switcher d'un environnement a l'autre;
- les templates charges doivent etre visibles uniquement dans l'environnement ou ils ont ete charges;
- les donnees doivent etre isolees par utilisateur et environnement;
- il doit etre possible de consulter les templates d'un autre utilisateur pour le meme environnement;
- seuls les admins peuvent assigner l'acces a un environnement a un utilisateur;
- tous les non-admins sont `editor`;
- les admins peuvent renommer les environnements;
- conserver l'historique.

Implementation generale:

- credentials stockes de maniere masquee/chiffree cote serveur;
- UI Settings pour gerer les environnements;
- UI Settings pour gerer les utilisateurs d'un environnement;
- possibilite d'assigner ou retirer l'acces d'utilisateurs existants;
- active environment pour filtrer imports/templates/WABAs/logs.

PUIG:

- l'utilisateur a ajoute des variables Vercel `PUIG_API` et `PUIG_PRODD`;
- `PUIG_API` est l'API key;
- `PUIG_PRODD` est l'API secret;
- un environnement `PUIG Prod` a ete ajoute;
- bug signale: selection de `PUIG Prod` dans la liste deroulante ne selectionnait pas correctement;
- correction faite autour de la selection d'environnement.

Erreur PUIG:

```text
Vonage WABA sync failed with 401 for "PUIG Prod" using API key ending in a4a3.
```

Conclusion probable:

- credentials Basic refuses par l'endpoint WABA-level;
- verifier si la cle est secondaire ou master selon le type d'appel;
- pour certaines ressources child, une secondary key peut fonctionner alors que la liste/detail WABA echoue.

## Variables d'environnement

Variables sensibles ou importantes discutees:

- `REDIS_URL`
- `KV_REST_API_READ_ONLY_TOKEN`
- `KV_REST_API_TOKEN`
- `KV_URL`
- `KV_REST_API_URL`
- `ADMIN_EMAILS`
- `NEXTAUTH_SECRET` / secret auth genere via `npm exec auth secret`
- Google OAuth env vars
- `VONAGE_API_KEY`
- `VONAGE_API_SECRET`
- `VONAGE_APPLICATION_ID`
- `VONAGE_PRIVATE_KEY`
- `VONAGE_VCR_CREDENTIAL_NAME`
- `PUIG_API`
- `PUIG_PRODD`

L'utilisateur a demande de supprimer les variables d'environnement non vitales au bon fonctionnement du site.

Important:

- ne pas creer `DATABASE_URL` si elle n'existe pas / n'est pas disponible;
- utiliser les variables deja presentes;
- ne pas exposer les secrets;
- ne jamais les ecrire dans un README ou un fichier de contexte en clair.

## Vonage WABA sync

Probleme majeur:

La sync WABA retournait parfois:

```text
0 WABA(s) synchronized
```

ou:

```text
Vonage authenticated the request but returned no WABAs (total_items: 0)
```

Support Vonage a confirme:

- la cle API finissant par `7877` est une secondary/sub API key;
- les endpoints WABA-level suivants necessitent une master API key:
  - `GET /v1/channel-manager/whatsapp/wabas`
  - `GET /v1/channel-manager/whatsapp/wabas/{waba_id}`
- les WABAs sont lies aux master API keys dans Channel Manager;
- les secondary keys peuvent fonctionner pour des child resources comme `/numbers` et `/templates`, mais pas forcement pour la liste/detail WABA.

Consequence:

- une secondary key peut avoir acces a certains enfants d'un WABA sans pouvoir lister les WABAs parents;
- pour contourner, l'application permet aussi de saisir manuellement des WABA IDs;
- la verification peut ensuite passer par les child resources quand possible.

WABAs connus sur la cle d'apres l'utilisateur:

- `110326855406164`
- `148929584978940`

## Ticket Vonage

Un ticket en anglais a ete prepare pour expliquer le probleme de recuperation des WABAs en environnement de test avant passage prod.

Points principaux:

- API key secondaire;
- endpoints WABA list/detail qui retournent vide ou erreur;
- child resources qui semblent fonctionner;
- besoin de comprendre comment lister correctement les WABAs accessibles.

## Rate limit templates

Une limite de soumission d'environ 100 templates par heure a ete evoquee.

Discussion:

- possibilite de programmer une soumission a une heure donnee;
- cron jobs Vercel sont possibles mais peuvent etre payants selon plan;
- alternative possible: file d'attente / scheduling applicatif / trigger manuel;
- attention aux limites de Vonage au moment de soumettre en masse.

## Passage VCR token au lieu de private key

Besoin demande:

- ne plus utiliser application ID + private key dans l'app;
- utiliser un appel token:

```text
GET https://api-eu.vonage.com/v1/creds/{SFMC_ACCOUNT_ID}-CERT/token
```

avec Basic Auth:

- username: VCR API account ID / API key
- password: VCR API account secret / API secret

Le token est valable 2h (`ttl = 7200`).

Comportement souhaite:

- recuperer automatiquement un token;
- le mettre en cache;
- le renouveler avant expiration, par exemple toutes les 1h55;
- utiliser ce token comme Bearer token pour les appels WhatsApp Template Management.

Le code a ete adapte pour recuperer un token VCR via `vcrAuthorizationHeader`.

## Tests VCR token

Certs / credentials testes pendant le debug:

- `00D06000001ljVXEAY-CERT`
- `00DQy00000HUvCtMAL-CERT`
- `00D1q0000008dkVEAQ-CERT`

Cert principal actuel:

```text
00D1q0000008dkVEAQ-CERT
```

Ancien application ID:

```text
64b77056-5168-40f7-ac29-c668440deb6b
```

Nouveau application ID fourni apres reset:

```text
24ccf338-6e0f-481b-9531-fce89c4dd630
```

Resultats importants:

1. L'appel `/v1/creds/00D1q0000008dkVEAQ-CERT/token` repond `HTTP 200`.
2. La reponse contient:
   - `provider`
   - `credential`
   - `id`
   - `body`
   - `generated_at`
   - `ttl`
   - `_links`
3. Le JWT utile est dans `body`.
4. `ttl = 7200`.
5. Le token a un header normal:

```text
alg = RS256
typ = JWT
```

6. Les claims sont:

```text
application_id
iat
exp
jti
```

7. Avant reset, le token contenait:

```text
application_id = 64b77056-5168-40f7-ac29-c668440deb6b
```

8. Apres reset et nouveau application ID fourni, le token retournait encore l'ancien application ID:

```text
application_id = 64b77056-5168-40f7-ac29-c668440deb6b
```

et non:

```text
24ccf338-6e0f-481b-9531-fce89c4dd630
```

9. Le fingerprint du token etait identique avant/apres reset:

```text
c7a0139e0d6d
```

10. Le `generated_at` retournait encore:

```text
2026-06-25T08:36:04Z
```

Conclusion apres reset:

- le reset n'etait pas encore pris en compte par l'endpoint `/creds`;
- ou le CERT `00D1q0000008dkVEAQ-CERT` n'etait pas rattache au nouveau application ID;
- ou le service retournait un token cache/non regenere.

## Probleme "Invalid Token"

Erreur observee:

```text
Vonage template list failed with 401: Invalid Token
```

Le token VCR etait bien recupere, mais l'API templates le refusait.

Tests effectues:

- Bearer token sur `https://api.nexmo.com/v2/whatsapp-manager/wabas/{waba_id}/templates?limit=1`
- Bearer token sur `https://api-eu.vonage.com/v2/whatsapp-manager/wabas/{waba_id}/templates?limit=1`
- prefix `JWT` au lieu de `Bearer`
- raw token sans prefix

Resultats:

- `Bearer` sur les deux hosts: `401 Invalid Token`;
- `JWT` prefix: `401 Invalid Token`;
- raw token: erreur auth header;
- donc le probleme n'est pas le host ni le prefix.

Verification cryptographique:

- l'utilisateur a fourni une public key;
- cette public key correspond bien a la private key locale du fichier de test;
- un JWT genere localement avec cette private key et le meme application ID fonctionne sur l'API templates (`200 OK`);
- le token VCR ne verifie pas avec cette public key;
- erreur de verification: signature verification failed.

Conclusion technique:

- le token VCR contient le bon `application_id` pour l'ancien contexte, mais sa signature ne correspond pas a la public key enregistree;
- l'API Vonage rejette donc le token;
- le probleme n'est pas le code, pas le WABA, pas l'endpoint, pas les claims, pas le host;
- le probleme est l'alignement cryptographique entre le CERT VCR et la paire de cles de l'application Vonage.

Apres reset:

- le CERT retournait encore un token pour l'ancien application ID;
- donc le nouveau contexte n'etait pas encore actif cote `/creds`.

## Private key / public key

Fichier private key de test cite par l'utilisateur:

```text
C:/Users/pc/Downloads/private_64b77056-5168-40f7-ac29-c668440deb6b.key
```

Ne jamais commiter ce fichier.

La public key fournie correspondait a cette private key locale.

Test local avec JWT genere depuis la private key:

- meme WABA;
- meme endpoint;
- meme application ID;
- meme style de claims que le token VCR;
- resultat: `200 OK`.

Conclusion:

- la private key locale fonctionne;
- le token VCR ne fonctionne pas;
- on ne peut pas "reparer" un token avec une public key;
- la public key sert a verifier, pas a signer;
- seul le service qui signe le token peut corriger la signature.

## Solutions possibles pour VCR / JWT

Sans support Vonage:

1. Utiliser la private key disponible et generer le JWT cote serveur.
   - Fonctionne pour le projet de test.
   - Pas viable pour d'autres projets si la private key n'est pas recuperable.

2. Creer une nouvelle application Vonage dediee et recuperer sa private key au moment de creation.
   - Viable seulement si cette app a acces aux ressources necessaires.

3. Utiliser uniquement les endpoints acceptant Basic Auth.
   - Peut marcher pour certaines child resources.
   - Pas suffisant pour l'API templates si elle exige un JWT valide.

Avec support Vonage / VCR:

1. Realigner ou regenerer `00D1q0000008dkVEAQ-CERT`.
2. Confirmer le bon `*-CERT` correspondant au nouvel application ID.
3. Faire en sorte que `/v1/creds/.../token` retourne un JWT signe avec la private key correspondant a la public key de l'application.
4. Verifier que le token contient le nouvel application ID:

```text
24ccf338-6e0f-481b-9531-fce89c4dd630
```

Message court prepare pour collegue:

```text
J'ai identifie le probleme cote authentification Vonage.

Le token recupere via le CERT VCR contient bien le bon application_id dans l'ancien contexte, donc il pointe vers l'application attendue. Par contre, sa signature JWT ne correspond pas a la public key enregistree sur cette application. Resultat: quand ce token est utilise sur l'API WhatsApp Template Management, Vonage repond 401 Invalid Token.

Pour verifier, j'ai genere un JWT localement avec la private key correspondante: meme application, meme WABA, meme endpoint, et la l'appel fonctionne en 200 OK.

Donc le probleme ne vient pas du code ni du WABA, mais du token genere par le CERT VCR, qui semble desaligne avec la cle publique de l'application. Il faut soit realigner/regenerer le CERT cote Vonage/VCR, soit utiliser une private key valide pour generer le JWT cote app.
```

Note: dans une version sans accent, remplacer `desaligne` / `cle` si necessaire.

## Routes temporaires de diagnostic

Pendant les audits, des routes temporaires ont ete creees puis supprimees:

- `/api/internal/vonage-secret-token-test`
- `/api/internal/vcr-chain-test`
- `/api/internal/vcr-audit`
- `/api/internal/vcr-reset-audit`
- `/api/internal/vcr-new-app-audit`

Des variables Vercel temporaires ont ete creees puis supprimees:

- `VCR_CHAIN_TEST_TOKEN`
- `VCR_AUDIT_TOKEN`
- `VCR_RESET_AUDIT_TOKEN`
- `VCR_NEW_APP_AUDIT_TOKEN`

Ces routes/variables ne doivent pas rester en production.

Avant ce fichier de memoire, la production a ete redeployee proprement sans ces routes temporaires.

## Comportement actuel attendu de l'application

L'application doit:

- authentifier via Google;
- restreindre aux domaines autorises;
- gerer les admins via `ADMIN_EMAILS`;
- gerer une whitelist persistante;
- permettre aux admins de gerer les utilisateurs;
- permettre aux admins d'assigner les environnements;
- permettre aux admins de creer/renommer/archiver des environnements;
- stocker les credentials d'environnement de maniere non visible cote UI;
- isoler imports/templates/logs par environnement;
- permettre de chercher/trier les templates par langue et marque;
- permettre edition/suppression individuelle ou en masse;
- permettre selection de templates pour un WABA;
- afficher les logs avec acteur humain;
- permettre de saisir manuellement des WABA IDs quand la liste WABA ne peut pas etre recuperee via une secondary key;
- afficher une erreur propre si la liste de templates Vonage echoue, sans crash de page.

## Limites et blocages restants

Blocage principal:

- tant que `00D1q0000008dkVEAQ-CERT` retourne un token invalide ou un token pour l'ancien application ID, l'API templates ne fonctionnera pas via VCR token.

Ce qu'il faut verifier apres correction cote Vonage/VCR:

1. Appeler:

```text
GET https://api-eu.vonage.com/v1/creds/00D1q0000008dkVEAQ-CERT/token
```

2. Decoder le JWT sans exposer sa valeur.
3. Confirmer:

```text
application_id = 24ccf338-6e0f-481b-9531-fce89c4dd630
```

4. Confirmer que le token n'est pas expire.
5. Tester:

```text
GET https://api.nexmo.com/v2/whatsapp-manager/wabas/110326855406164/templates?limit=1
Authorization: Bearer <token>
```

6. Resultat attendu:

```text
HTTP 200
```

Si le token contient encore `64b77056-5168-40f7-ac29-c668440deb6b`, le reset n'est pas actif pour ce CERT.

Si le token contient le nouvel application ID mais retourne encore `401 Invalid Token`, il faut verifier la signature avec la public key du nouvel application ID.

## Commandes utiles

Lancer les tests:

```bash
npm test
```

Build:

```bash
npm run build
```

Lint:

```bash
npm run lint
```

Deploy production:

```bash
vercel --prod --yes
```

Voir les logs Vercel:

```bash
vercel logs https://vonage-whatsapp-template-manager.vercel.app --since 10m
```

Verifier l'etat git:

```bash
git status --short --branch
```

## Hygiene securite

Ne jamais commiter:

- private keys;
- tokens JWT complets;
- API secrets;
- fichiers temporaires `.tmp-*`;
- routes internes de debug;
- logs contenant des secrets;
- `.env.local` si non ignore.

Les diagnostics doivent renvoyer uniquement:

- statuts HTTP;
- noms de champs;
- suffixes non sensibles;
- fingerprints courts;
- timestamps;
- application IDs si necessaires;
- messages d'erreur API.

## Dernier etat connu

Dernier etat connu apres le reset utilisateur:

- production redeployee proprement;
- routes temporaires supprimees;
- variables temporaires supprimees;
- token VCR encore rattache a l'ancien application ID;
- appels templates avec token VCR toujours en `401 Invalid Token`;
- JWT local signe avec la private key de test fonctionnait en `200 OK` pour l'ancien application ID;
- solution attendue: realignement VCR/CERT ou token emis pour le nouvel application ID avec signature valide.
