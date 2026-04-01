# ✅ eBrigade Mapping - NOUVEAU SYSTÈME ROBUSTE

## 🎉 CE QUI A CHANGÉ

**Avant:** Admin devait cocher 100+ codes individuellement (9336, 9610, 9395, etc.)
```
☐ 9336
☐ 9610  
☑ 9395
☐ 9610b
☐ ... (100 codes)
```
❌ Fragile, fastidieux, scalability nightmare

**Maintenant:** Admin tape UNE FOIS le nom du pattern
```
Input: "Permanence INFI"
Ajouter ✓

Tags: [Permanence INFI] ✕
```
✅ Simple, robuste, scalable

---

## 🚀 COMMENT UTILISER

### Pour l'Admin

**Étape 1:** Admin → Activités → Click "Edit" sur une activité

**Étape 2:** Section "Associer à des analytiques eBrigade"

```
Input: "Permanence INFI"
[+ Add]

Tags actuels:
[Permanence INFI] ✕
```

**Étape 3:** Click "+ Add"

**Étape 4:** Enregistrer

Done! ✅

### Pour l'User

L'utilisateur ne change rien. Même flow:
1. Dashboard → Select "Permanence INFI | 14h -21h"
2. Declare hours: 7
3. Click estimate
4. Résultat: **281.75€** (40.25 × 7) ✅ PAS 20€ fallback ❌

---

## 🔬 COMMENT ÇA FONCTIONNE

### Exemple: Code 9610 + Code 9395 + Code 9336

Tous les trois codes eBrigade ont des **E_LIBELLE** différents:
- Code 9610 → "Permanence INFI | 07h-14h"
- Code 9395 → "Permanence INFI | 14h-21h"  
- Code 9336 → "Permanence INFI | 22h-07h"

Mais le **PRÉFIXE est identique**: "Permanence INFI"

### Flux de Calcul

```
User déclare heures sur code 9610
   ↓
E_LIBELLE = "Permanence INFI | 07h-14h"
   ↓
estimate.js extrait le PREFIX: "Permanence INFI"
   ↓
Cherche dans activity_ebrigade_name_mappings:
SELECT activity_id WHERE ebrigade_analytic_name_pattern = "Permanence INFI"
   ↓
Trouve: activity_id = 4
   ↓
Charge tarifs: remuneration_infi = 40.25€
   ↓
Calcul: 40.25€ × 7h = 281.75€ ✅
```

---

## 📊 Exemple Complet

### Setup Admin (une seule fois)

1. Éditer "Permanence INFI"
2. Input: "Permanence INFI"
3. Click "+ Add"  
4. Enregistrer

### Résultat

Tous ces **codes** sont maintenant mappés:
- 9336 ("Permanence INFI | 22h-07h")
- 9395 ("Permanence INFI | 14h-21h")
- 9402 ("Permanence INFI | variation")
- 9610 ("Permanence INFI | 07h-14h")
- 9610b (même nom)
- ... (tout code avec ce prefix)

### Test

User déclare:
```
Activité: Permanence INFI | 07h-14h (code 9610)
Heures: 7
Type: Garde
```

Estimation:
```
✓ Found activity via eBrigade name pattern: "Permanence INFI"
✓ Activity: Permanence INFI
✓ Rate: 40.25€/h
✓ Calculation: 40.25 × 7 = 281.75€
```

---

## 🛠️ TECHNIQUEMENT

**Nouvelle table:** `activity_ebrigade_name_mappings`
```sql
CREATE TABLE activity_ebrigade_name_mappings (
  id SERIAL PRIMARY KEY,
  activity_id INTEGER,
  ebrigade_analytic_name_pattern VARCHAR(255),  -- e.g., "Permanence INFI"
  created_at TIMESTAMP,
  UNIQUE(activity_id, ebrigade_analytic_name_pattern)
)
```

**Endpoints modifiés:**
- `estimate.js`: Lookup by name prefix (PRIMARY method)
- `available.js`: Returns name patterns
- `activities/[id].js`: Saves name patterns
- `CreateActivityModal.jsx`: Simple text input UI

---

## ⚡ AVANTAGES

| Aspect | Avant | Après |
|--------|-------|-------|
| **Setup** | Cocher 100+ cases | Taper 1 fois le nom |
| **Maintenance** | Ajouter chaque code | Auto-match par prefix |
| **Scalability** | O(n) codes | O(1) patterns |
| **Robustness** | Fragile prefix extraction | Direct pattern match |
| **UX** | Confusing checkboxes | Simple input |

---

## ✅ PROCHAINES ÉTAPES

1. **Deploy sur serveur** (git pull + pm2 restart)
2. **Run migration script** (crée la nouvelle table):
   ```bash
   node scripts/migrate-to-name-based.js
   ```
3. **Admin edits activities** - ajoute les patterns une fois
4. **Test** - déclare heures, vérifie le calcul
5. **Done!** 🎉

---

## 🔍 Vérification

Avant de tester:
```bash
# Vérifier que la table existe
psql -c "SELECT * FROM activity_ebrigade_name_mappings"

# Vérifier un pattern spécifique
psql -c "SELECT * FROM activity_ebrigade_name_mappings WHERE ebrigade_analytic_name_pattern = 'Permanence INFI'"
```

---

**C'est maintenant ROBUSTE!** ✨ Pas de fuzzy matching, pas de 100+ codes à maintenir juste un simple pattern "Permanence INFI" et tous les codes matchent automatiquement.
