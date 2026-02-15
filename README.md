## Concept

Une extension Firefox interceptant les requêtes HTTP de navigation pour bloquer les redirections automatiques basées sur la géolocalisation ou les paramètres régionaux (codes HTTP 301, 302 vers des TLD différents). Elle garantit l'accès au domaine de premier niveau (TLD) explicitement saisi par l'utilisateur en interrompant la chaîne de redirection et en forçant le chargement de l'URL initiale.

## Stack Technique

* **API WebExtensions** : Utilisation de l'API `declarativeNetRequest` (ou `webRequest` avec blocage) pour l'interception performante des requêtes réseau au niveau du navigateur.
* **JavaScript Vanilla (ES2022)** : Garantit une exécution rapide et légère du background worker sans surcharge liée à un framework externe.
* **HTML5/CSS3** : Interface utilisateur de la popup d'extension minimale et réactive pour la gestion des règles.
* **Vite** : Outil de build pour la compilation, la minification des assets et la gestion du rechargement à chaud durant le développement.
