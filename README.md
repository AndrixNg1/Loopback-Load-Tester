# Localhost API Load Tester

Ce projet sert uniquement a envoyer une charge bornee vers une autre API deja lancee sur la meme machine.

Restriction importante :

- la cible doit rester sur `127.0.0.1`, `::1` ou `localhost`
- l'outil refuse toute cible distante
- il ne contient plus d'API cible interne

## Prerequis

- Node.js 18+
- npm

## Installation

```bash
npm install
cp .env.example .env
```

## Configuration

Edite [`.env`](./.env).

Variables :

- `TARGET_HOST` : `127.0.0.1`, `localhost` ou `::1`
- `TARGET_PORT` : port de l'API locale a tester
- `TARGET_PATH` : route cible, query string comprise si besoin
- `CONNECTIONS` : nombre de connexions paralleles
- `DURATION_SECONDS` : duree du test

Exemple pour `drix-api` :

```env
TARGET_HOST=127.0.0.1
TARGET_PORT=3000
TARGET_PATH=/api/posts/feed?page=1&limit=10
CONNECTIONS=25
DURATION_SECONDS=15
```

## Lancer un test

```bash
npm run attack
```

L'outil affiche :

- la latence
- le debit `Req/Sec`
- les volumes lus
- le nombre de `2xx`, `3xx`, `4xx`, `5xx`
- les erreurs et timeouts
- un message clair si l'API cible ne repond pas avant le test

## Tester une autre API locale

1. Demarrer l'API a observer.
2. Verifier qu'elle repond normalement avec `curl`.
3. Regler [`.env`](./.env).
4. Lancer :

```bash
npm run attack
```

## Exemple avec drix-api

Verifier l'endpoint :

```bash
curl http://127.0.0.1:3000/api
curl 'http://127.0.0.1:3000/api/news?page=1&limit=10'
curl 'http://127.0.0.1:3000/api/posts/feed?page=1&limit=10'
```

Tester `news` :

```env
TARGET_HOST=127.0.0.1
TARGET_PORT=3000
TARGET_PATH=/api/news?page=1&limit=10
CONNECTIONS=25
DURATION_SECONDS=15
```

Puis :

```bash
npm run attack
```

Tester `posts/feed` :

```env
TARGET_HOST=127.0.0.1
TARGET_PORT=3000
TARGET_PATH=/api/posts/feed?page=1&limit=10
CONNECTIONS=25
DURATION_SECONDS=15
```

Puis :

```bash
npm run attack
```

## Observation conseillee

Pendant le test, ouvre d'autres terminaux :

```bash
docker logs -f drix-api
docker stats drix-api drix-db
```

Si l'API utilise PostgreSQL :

```bash
docker exec -it drix-db psql -U drix -d drix -c "
select state, count(*)
from pg_stat_activity
where datname = 'drix'
group by state
order by state;
"
```

## Lecture des resultats

- Si la latence monte mais qu'il n'y a pas d'erreur, l'API degrade sans encore casser.
- Si des `5xx`, timeouts ou erreurs Prisma apparaissent, tu as atteint un seuil de rupture.
- Si la DB commence a saturer, observe les transactions, locks et connexions.

## Paliers simples

Charge legere :

```env
CONNECTIONS=10
DURATION_SECONDS=10
```

Charge moyenne :

```env
CONNECTIONS=25
DURATION_SECONDS=15
```

Charge forte :

```env
CONNECTIONS=50
DURATION_SECONDS=15
```

Charge tres forte :

```env
CONNECTIONS=100
DURATION_SECONDS=15
```

## Notes

- Si tu changes la cible, modifie seulement [`.env`](./.env).
- L'outil envoie des `GET` uniquement.
- Le but est l'observation defensive sur une API locale que tu controles.
