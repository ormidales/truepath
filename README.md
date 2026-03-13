## Concept

Une extension Firefox interceptant les requêtes HTTP de navigation pour bloquer les redirections automatiques basées sur la géolocalisation ou les paramètres régionaux (codes HTTP 301, 302, 303, 307, 308 vers des TLD différents). Elle garantit l'accès au domaine de premier niveau (TLD) explicitement saisi par l'utilisateur en interrompant la chaîne de redirection et en forçant le chargement de l'URL initiale.

## Comportement Accept-Language

L'extension peut ajuster l'en-tête `Accept-Language` des requêtes pour aider à prévenir les boucles de redirection géographiques. Cet ajustement est effectué **uniquement** lorsqu'une redirection a déjà été détectée pour la requête en cours (même identifiant de requête), c'est-à-dire lors du suivi d'une redirection vers un sous-domaine du même TLD.

Les chargements de page initiaux (sans redirection préalable) utilisent la vraie valeur `Accept-Language` du navigateur, ce qui préserve la vie privée de l'utilisateur et évite de divulguer l'intention de navigation par TLD à chaque site visité.

## Stack Technique

* **API WebExtensions** : Utilisation de l'API `webRequest` avec `webRequestBlocking` (Manifest V2) pour l'interception synchrone et l'annulation des requêtes réseau au niveau du navigateur.
* **JavaScript Vanilla (ES2022)** : Garantit une exécution rapide et légère du background worker sans surcharge liée à un framework externe.
* **HTML5/CSS3** : Interface utilisateur de la popup d'extension minimale et réactive pour la gestion des règles.
* **Vite** : Outil de build pour la compilation, la minification des assets et la gestion du rechargement à chaud durant le développement.

## Compatibilité & Roadmap

L'extension utilise actuellement **Manifest V2** avec `webRequestBlocking`, seule API permettant l'inspection et l'annulation synchrone des redirections HTTP basées sur les headers de réponse.

| Navigateur | Support MV2          | Calendrier de fin de support |
|------------|----------------------|------------------------------|
| Firefox    | ✅ Maintenu à long terme | Indéfini (engagement Mozilla) |
| Chrome     | ⚠️ Déprécié           | Retiré depuis Chrome 127 (juin 2024) pour les extensions non-entreprise |

### Pourquoi pas Manifest V3 ?

L'API `declarativeNetRequest` (MV3) est à l'étude comme piste de migration future, mais présente des limitations bloquantes pour ce cas d'usage :

* **Accès limité aux headers de réponse** : `declarativeNetRequest` ne permet pas l'inspection dynamique des headers HTTP de réponse (ex. `Location`) en temps réel, contrairement à `webRequest`.
* **Absence de blocage synchrone** : MV3 ne supporte pas le blocage synchrone des requêtes, rendant impossible l'annulation à la volée d'une redirection selon son contenu.

La migration vers MV3 sera envisagée lorsque l'API `declarativeNetRequest` offrira un accès équivalent aux headers de réponse et des capacités de filtrage dynamique.

## Idées de logos

* Minimalist logo for a browser extension, a crossed-out globe icon, flat vector design, solid blue and red colors, clean white background.
* Clean icon of a compass breaking a circular redirect arrow, dark mode aesthetics, neon green accents, UI/UX application style.
* Simple typographic logo with the letters GRB inside a web browser window frame, a shield enclosing a world map, solid colors, corporate tech style.
* Abstract geometric design of a straight line piercing through curved HTTP redirect arrows, minimalist, monochrome vector graphic.
* Icon of a location pin locked with a steel padlock, modern flat vector, cybersecurity style, professional blue and grey color palette.
