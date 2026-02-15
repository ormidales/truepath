## Concept

Une extension Firefox interceptant les requêtes HTTP de navigation pour bloquer les redirections automatiques basées sur la géolocalisation ou les paramètres régionaux (codes HTTP 301, 302 vers des TLD différents). Elle garantit l'accès au domaine de premier niveau (TLD) explicitement saisi par l'utilisateur en interrompant la chaîne de redirection et en forçant le chargement de l'URL initiale. En complément, elle ajuste dynamiquement l'en-tête `Accept-Language` des requêtes de navigation pour limiter les blocages serveur de type `403 Forbidden` quand le routage régional est empêché.

## Stack Technique

* **API WebExtensions** : Utilisation de l'API `declarativeNetRequest` (ou `webRequest` avec blocage) pour l'interception performante des requêtes réseau au niveau du navigateur.
* **JavaScript Vanilla (ES2022)** : Garantit une exécution rapide et légère du background worker sans surcharge liée à un framework externe.
* **HTML5/CSS3** : Interface utilisateur de la popup d'extension minimale et réactive pour la gestion des règles.
* **Vite** : Outil de build pour la compilation, la minification des assets et la gestion du rechargement à chaud durant le développement.

## Idées de logos

* Minimalist logo for a browser extension, a crossed-out globe icon, flat vector design, solid blue and red colors, clean white background.
* Clean icon of a compass breaking a circular redirect arrow, dark mode aesthetics, neon green accents, UI/UX application style.
* Simple typographic logo with the letters GRB inside a web browser window frame, a shield enclosing a world map, solid colors, corporate tech style.
* Abstract geometric design of a straight line piercing through curved HTTP redirect arrows, minimalist, monochrome vector graphic.
* Icon of a location pin locked with a steel padlock, modern flat vector, cybersecurity style, professional blue and grey color palette.
