# Analyse de la génération PDF - Logique actuelle

## Contexte et problème utilisateur
**Citation utilisateur**: "je sais qu'on avait pas utilisé le mapping pour la génération de pdf car il y avait des soucis donc analyse la génération de pdf pour voir la logique"

Cela suggère que le mapping eBrigade vers analytics n'était **PAS utilisé** lors de la génération de PDF pour certaines raisons (bugs, décision, limitation temps).

## Architecture actuelle (Pages API `/api/admin/prestations/[id].js`)

### 1. **Colonnes pertinentes dans `prestations` table**
- `ebrigade_activity_code` → Code numérique d'eBrigade (ex: "9610", "9395")
- `ebrigade_activity_name` → Label/nom d'eBrigade (ex: "Permanence INFI", "Ambulance")
- `analytic_id` → FK vers analytics (sera NULL si le mapping échoue)
- `remuneration_infi`, `remuneration_med` → **MONTANTS TOTAUX** (pas hourly rates!)

### 2. **Deux tables de mapping eBrigade**

**Table 1: `activity_ebrigade_mappings`** (codes numériques)
```sql
CREATE TABLE activity_ebrigade_mappings (
  id SERIAL PRIMARY KEY,
  activity_id INTEGER NOT NULL,      -- → activities table
  ebrigade_analytic_name VARCHAR(100) -- Ex: "9610", "9395" (code)
)
```
- Utilisée dans la base de données UPDATE que nous venons d'exécuter ✓
- Contient les codes simples

**Table 2: `activity_ebrigade_name_mappings`** (patterns de nom)
```sql
CREATE TABLE activity_ebrigade_name_mappings (
  id SERIAL PRIMARY KEY,
  activity_id INTEGER NOT NULL,
  ebrigade_analytic_name_pattern VARCHAR(255)  -- Ex: "Permanence INFI", "Ambulance"
)
```
- Utilisée pour pattern matching lors de la génération PDF
- Contient des patterns plus deskriptifs

### 3. **Flux de génération PDF (lors de `status = "En attente d'envoie"`)**

**Étape 1: Chercher taux horaires via eBrigade name mapping**
```javascript
// TENTATIVE 1: Pattern matching sur le nom d'eBrigade
if (updatedRow.ebrigade_activity_name) {
  const ratesQ = await pool.query(
    `SELECT act.remuneration_infi, act.remuneration_med, ...
     FROM activity_ebrigade_name_mappings nm
     JOIN activities act ON nm.activity_id = act.id
     WHERE $1 ILIKE '%' || nm.ebrigade_analytic_name_pattern || '%'
     ORDER BY LENGTH(nm.ebrigade_analytic_name_pattern) DESC LIMIT 1`,
    [updatedRow.ebrigade_activity_name]
  )
}
```
**⚠️ Problème possibles:**
- Utilise `ILIKE` (case-insensitive substring match)
- Cherche via `ebrigade_activity_name` (label) et non `ebrigade_activity_code` (code)
- Si `ebrigade_activity_name` est NULL ou ne correspond pas → FAIL

**Étape 2: Fallback sur analytic_id**
```javascript
// TENTATIVE 2: Directement via analytic_id déjà assigné
if (!ratesRow && updatedRow.analytic_id) {
  const ratesQ2 = await pool.query(
    `SELECT remuneration_infi, remuneration_med, ...
     FROM activities WHERE analytic_id = $1 ORDER BY date DESC LIMIT 1`,
    [updatedRow.analytic_id]
  )
}
```
**⚠️ Problème:**
- Dépend de `analytic_id` être NON-NULL dans prestation
- Mais tous nos 33 prestations avec PDF avaient `analytic_id = NULL`!
- Donc cette recherche échoue aussi

**Étape 3: Fallback "dérivé" (derive from total / hours)**
```javascript
if (rateGarde === 0 && totalAmount > 0 && (gardeH + sortieH) > 0) {
  rateGarde = Number((totalAmount / (gardeH + sortieH)).toFixed(2))
  rateSortie = rateGarde
}
```
- ✓ Peut fonctionner SI `totalAmount` et heures sont correctes
- MAIS: Si les heures manquent aussi → Montant zéro

## 🔴 Le vrai problème : "Mapping not used"

### Pourquoi le mapping n'était PAS utilisé:

1. **Première raison identifiée**: `ebrigade_activity_name` souvent vide ou non-matching
   - eBrigade envoie souvent juste le CODE ("9610")
   - Pas le label complet ("Permanence INFI")
   - Donc le pattern match échoue

2. **Deuxième raison**: `analytic_id` jamais assigné
   - Même si le pattern matching fonctionnait, il n'était pas sauvé à `prestations.analytic_id`
   - Les taux trouvés transitoirement étaient utilisés pour le PDF
   - Mais l'asignement à la base de données ne se faisait pas
   - C'est LE BUG! Les taux étaient calculés, BUT pas sauvés pour utilisation ultérieure

3. **Troisième raison - comme YOU mentionné**: Mapping avait des soucis
   - Peut-être que `activity_ebrigade_name_mappings` était vide ou mal remplie
   - Peut-être que les patterns ne correspondaient pas aux valeurs réelles d'eBrigade

### Code missing: Saving analytic_id found via mapping

**Logique actuelle:**
```javascript
// Cherche taux via mapping
// Les utilise pour générer PDF
// MAIS NE SAUVEGARDE PAS l'analytic_id trouvé!
```

**Logique manquante:**
```javascript
// Quand le mapping trouve une activité:
if (ratesRow && ratesRow.activity_id && !updatedRow.analytic_id) {
  // DEVRAIT faire:
  // UPDATE prestations SET analytic_id = activities[activity_id].analytic_id WHERE id = ...
  // MAIS CE CODE N'EXISTE PAS!
}
```

## ✅ Solution appliquée (conversation précédente)

L'UPDATE que nous avons exécuté:
```sql
UPDATE prestations p
SET analytic_id = (
  SELECT a.analytic_id
  FROM activities a
  JOIN activity_ebrigade_mappings aem ON a.id = aem.activity_id
  WHERE aem.ebrigade_analytic_name = p.ebrigade_activity_code  ← Utilise CODE pas name
  LIMIT 1
)
WHERE p.analytic_id IS NULL AND p.pdf_url IS NOT NULL AND p.ebrigade_activity_code IS NOT NULL
```

**Résultat: 30 prestations récupérées** ✓

## 📋 Recommandations pour fixer la génération PDF

### 🔧 Option 1: Utiliser le CODE (plus robuste)
```javascript
// Dans [id].js, lors de la recherche de taux:
if (!ratesRow && updatedRow.ebrigade_activity_code) {
  const ratesQ = await pool.query(
    `SELECT act.remuneration_infi, act.remuneration_med, ...
     FROM activity_ebrigade_mappings aem  ← Utiliser la TABLE CODE
     JOIN activities act ON aem.activity_id = act.id
     WHERE aem.ebrigade_analytic_name = $1  ← Chercher par CODE
     ORDER BY aem.activity_id LIMIT 1`,
    [updatedRow.ebrigade_activity_code]
  )
}
```

### 🔧 Option 2: Sauvegarder analytic_id quand trouvé
```javascript
// Après avoir trouvé ratesRow via mapping:
if (ratesRow && ratesRow.activity_id && !updatedRow.analytic_id) {
  const [[actDetail]] = await pool.query(
    `SELECT analytic_id FROM activities WHERE id = $1 LIMIT 1`,
    [ratesRow.activity_id]
  )
  if (actDetail && actDetail.analytic_id) {
    await pool.query(
      `UPDATE prestations SET analytic_id = $1 WHERE id = $2`,
      [actDetail.analytic_id, id]
    )
  }
}
```

### 🔧 Option 3: Fusionner les deux tables
```javascript
// Créer UNE SEULE table avec tous les mappings (codes ET patterns)
// Éliminer `activity_ebrigade_name_mappings`
// Utiliser seulement `activity_ebrigade_mappings` partout
```

## Résumé: Pourquoi le mapping "n'était pas utilisé"

**La vraie raison**: Le mapping ÉTAIT utilisé pour CALCULER les taux lors de PDF generation, mais:
1. ✗ Les taux erano calculés en mémoire, pas sauvés
2. ✗ Le pattern matching sur `ebrigade_activity_name` échouait souvent
3. ✗ `analytic_id` restait NULL après génération PDF
4. ✗ Les prestations n'étaient pas groupables par analytic_id → Problème visibilité page "Générer & Envoyer"

**La fix appliquée**: Populer `analytic_id` directement via le CODE plutôt que chercher à chaque PDF.
