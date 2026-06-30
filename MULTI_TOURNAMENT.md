# Multi-Tournament Architecture

Documenta los cambios de backend introducidos para convertir ConcursoMundial de una app exclusiva del Mundial 2026 en una plataforma de pronósticos multi-torneo y multi-temporada.

---

## Nuevos modelos

### `Tournament` — plantilla de competición

```
backend/src/models/Tournament.js
```

| Campo | Tipo | Descripción |
|---|---|---|
| `name` | String | Nombre del torneo (ej. "FIFA World Cup") |
| `slug` | String (unique) | Identificador URL-friendly |
| `sport` | String | Deporte (default `"football"`) |
| `type` | `"official"` \| `"custom"` | Official = plataforma; custom = creado por usuario |
| `icon` | String | Emoji o URL de imagen |
| `createdBy` | ref User | `null` para torneos oficiales (seeded por admin) |
| `isPublic` | Boolean | Los torneos oficiales son públicos; los custom privados por defecto |

---

### `Season` — edición específica de un torneo

```
backend/src/models/Season.js
```

| Campo | Tipo | Descripción |
|---|---|---|
| `tournament` | ref Tournament | Torneo al que pertenece |
| `name` | String | Nombre completo (ej. "FIFA World Cup 2026") |
| `year` | Number | Año de la edición |
| `status` | `upcoming` \| `active` \| `finished` \| `archived` | Estado |
| `createdBy` | ref User | Creador (null para temporadas oficiales) |
| `apiProvider` | `"football-data"` \| `null` | Integración API (solo torneos oficiales) |
| `apiTournamentId` | String | ID externo del torneo en el proveedor API |
| `teams` | `[String]` | Lista de equipos en texto libre (solo torneos custom) |
| `stages` | `[StageSchema]` | Fases/etapas de la temporada (ver abajo) |
| `defaultScoringConfig` | ScoringConfigSchema | Puntuación base heredada por todos los grupos |
| `tournamentPredictionFields` | `[PredictionFieldSchema]` | Campos de pronóstico de torneo configurables |

#### StageSchema (subdocumento, sin `_id`)

| Campo | Tipo | Descripción |
|---|---|---|
| `key` | String | Clave interna (ej. `"group_stage"`, `"final"`, o cualquier string custom) |
| `name` | String | Etiqueta de display |
| `order` | Number | Orden de visualización |
| `isKnockout` | Boolean | Si es `true`, el formulario de pronóstico muestra la selección de ganador |

#### ScoringConfigSchema (subdocumento, sin `_id`)

| Campo | Default | Descripción |
|---|---|---|
| `correctOutcome` | 2 | Puntos por acertar W/D/L |
| `oneTeamCorrect` | 1 | Puntos cuando solo un marcador es exacto |
| `exactScoreBonus` | 3 | Bonus (sobre `correctOutcome`) cuando ambos marcadores son exactos |
| `knockoutWinnerBonus` | 3 | Bonus cuando el usuario predijo empate en 90min y acertó el clasificado |
| `extraTimeBonus` | 0 | Bonus si predijo tiempo extra y el partido fue a TE |
| `penaltiesBonus` | 0 | Bonus si predijo penales y el partido fue a penales |

> Puntuación máxima por partido = `correctOutcome + exactScoreBonus` (default 5).  
> Con bono knockout = `correctOutcome + exactScoreBonus + knockoutWinnerBonus` (default 8).

#### PredictionFieldSchema (subdocumento, sin `_id`)

| Campo | Tipo | Descripción |
|---|---|---|
| `key` | String | Clave interna (ej. `"champion"`, `"topScorer"`, o custom) |
| `label` | String | Etiqueta de display (ej. `"Campeón"`) |
| `type` | `"team"` \| `"player"` \| `"text"` | Tipo de valor esperado |
| `points` | Number | Puntos que vale este campo |
| `enabled` | Boolean | Si el campo está activo para esta temporada |

---

## Modelos modificados

### `Group` — agrega `season` y `scoringConfig`

```
backend/src/models/Group.js
```

Nuevos campos:

| Campo | Tipo | Descripción |
|---|---|---|
| `season` | ref Season | Temporada en la que compite el grupo (null = WC2026 legado) |
| `scoringConfig` | ScoringConfigSchema | Override de puntuación por grupo (null = hereda de la temporada) |

La puntuación efectiva de un grupo es:  
`DEFAULT_SCORING → mergeWith(season.defaultScoringConfig) → mergeWith(group.scoringConfig)`

---

### `Match` — agrega `season`, nombres de equipos custom y flag manual

```
backend/src/models/Match.js
```

Nuevos campos:

| Campo | Tipo | Descripción |
|---|---|---|
| `season` | ref Season | Temporada a la que pertenece el partido |
| `homeTeamName` | String | Nombre en texto libre (torneos custom sin Team collection) |
| `awayTeamName` | String | Nombre en texto libre |
| `isManual` | Boolean | `true` = el creador de la temporada ingresa el marcador a mano |

**Cambio breaking:** `stage` ya no tiene `enum` en el schema. Los valores del WC2026 (`group_stage`, `round_of_16`, etc.) siguen funcionando; los torneos custom pueden usar cualquier string.

---

## Servicio de scoring actualizado

```
backend/src/services/scoring.js
```

`calcMatchPoints` acepta un sexto parámetro `scoringConfig`:

```js
calcMatchPoints(
  predictedHome, predictedAway,
  actualHome, actualAway,
  predictedWinner, actualWinner,
  scoringConfig   // objeto con los campos de ScoringConfigSchema (todos opcionales)
)
```

Los campos ausentes caen al `DEFAULT_SCORING`. Retrocompatible: todas las llamadas existentes sin el parámetro usan los valores por defecto actuales.

`calculateMatchPredictions(matchId)` ahora carga `season.defaultScoringConfig` del partido y lo pasa a `calcMatchPoints` antes de guardar los puntos en la predicción.

---

## Nuevas rutas

### `GET /api/tournaments`
Lista torneos oficiales + torneos custom creados por el usuario autenticado.  
Incluye `seasonCount` por torneo.

### `GET /api/tournaments/:id`
Detalle del torneo + array de sus temporadas.

### `POST /api/tournaments`
Crea un torneo custom. Cualquier usuario autenticado puede hacerlo.

```json
{ "name": "Mi Liga de Oficina", "icon": "⚽" }
```

### `PATCH /api/tournaments/:id`
Edita nombre/icono. Solo el creador puede hacerlo; los torneos oficiales no son editables.

---

### `GET /api/seasons`
Lista todas las temporadas accesibles: oficiales + las del usuario.

### `GET /api/seasons/:id`
Detalle de una temporada (stages, teams, scoring, prediction fields).

### `POST /api/seasons`
Crea una nueva temporada. Admins para torneos oficiales; creador del torneo para custom.

```json
{
  "tournamentId": "...",
  "name": "Mi Liga 2025",
  "year": 2025,
  "stages": [
    { "key": "grupos", "name": "Fase de grupos", "order": 1, "isKnockout": false },
    { "key": "final", "name": "Final", "order": 2, "isKnockout": true }
  ],
  "teams": ["Real Madrid", "Barcelona", "Manchester City"],
  "defaultScoringConfig": { "correctOutcome": 3, "exactScoreBonus": 2 },
  "tournamentPredictionFields": [
    { "key": "champion", "label": "Campeón", "type": "text", "points": 20, "enabled": true }
  ]
}
```

### `PATCH /api/seasons/:id`
Edita metadatos, stages, equipos, scoring o campos de pronóstico de torneo.

---

### `GET /api/seasons/:id/matches`
Lista todos los partidos de una temporada con populate de equipos.

### `POST /api/seasons/:id/matches`
Crea un partido (solo temporadas custom, solo el creador).

```json
{
  "homeTeamName": "Real Madrid",
  "awayTeamName": "Barcelona",
  "matchDate": "2025-05-10T20:00:00Z",
  "stage": "final",
  "venue": "Estadio Monumental"
}
```

### `PATCH /api/seasons/:id/matches/:matchId`
Edita datos del partido o carga el marcador final.  
Cuando se envían `homeScore`/`awayScore`, el partido pasa a `finished` y se recalculan los puntos de todas las predicciones usando `season.defaultScoringConfig`.

```json
{
  "homeScore": 2,
  "awayScore": 1,
  "winner": null,
  "decidedBy": "regular_time"
}
```

### `DELETE /api/seasons/:id/matches/:matchId`
Elimina el partido y sus predicciones. No se pueden eliminar partidos finalizados.

---

### `PATCH /api/groups/:id/scoring`
Permite al creador del grupo configurar puntuación personalizada.

```json
{
  "scoringConfig": {
    "correctOutcome": 3,
    "oneTeamCorrect": 1,
    "exactScoreBonus": 2,
    "knockoutWinnerBonus": 5,
    "extraTimeBonus": 0,
    "penaltiesBonus": 0
  }
}
```

Respuesta incluye `scoringConfig` (guardado) y `effectiveScoringConfig` (con defaults aplicados).

---

### `POST /api/groups` (actualizado)
Ahora acepta `seasonId` opcional en el body para asociar el grupo a una temporada.

---

## Leaderboard actualizado

```
backend/src/routes/leaderboard.js
```

`GET /api/leaderboard/:groupId` ahora:

1. Carga `group.scoringConfig` y `group.season.defaultScoringConfig`.
2. Si el grupo **no tiene** scoring custom → usa el **camino rápido**: agrega los puntos pre-calculados en `MatchPrediction.points` (igual que antes).
3. Si el grupo **tiene** scoring custom → **recalcula** on-the-fly: carga todas las predicciones con datos del partido y aplica `calcMatchPoints` con la config efectiva del grupo.

---

## Script de migración

```
backend/src/seeds/migrateToMultiTournament.js
npm run migrate:multi-tournament
```

**Idempotente** — se puede correr múltiples veces sin duplicar datos.

1. Crea (o encuentra) el documento `Tournament` con `slug: "fifa-world-cup"`.
2. Crea (o encuentra) el `Season` "FIFA World Cup 2026" con:
   - Los 7 stages del WC2026 con sus flags `isKnockout` correctos.
   - Los 6 campos de pronóstico de torneo (campeón, subcampeón, goleador, etc.) con sus puntos originales.
   - `defaultScoringConfig` igual a los valores hardcodeados actuales.
3. Estampa `season: <wc2026Id>` en **todos los Match** que no tienen season.
4. Estampa `season: <wc2026Id>` en **todos los Group** que no tienen season.

> **Correr antes del deploy** en producción para que los datos existentes queden asociados a la nueva estructura.

---

## Frontend (GroupDashboard)

El panel de configuración del grupo (solo creador) tiene una nueva sección **"Puntuación personalizada"** que permite editar los 6 campos de scoring con preview del máximo de puntos por partido.

Endpoint: `PATCH /api/groups/:id/scoring`

---

## Pendiente (próximas sesiones)

- [ ] Páginas frontend de browsing/creación de torneos y temporadas
- [ ] Selector de temporada al crear un grupo
- [ ] UI de gestión de partidos para temporadas custom (agregar partidos, cargar marcadores)
- [ ] Formulario de pronóstico de torneo para campos custom (no hardcodeado a WC2026)
- [ ] Vista de historial de temporadas por torneo
