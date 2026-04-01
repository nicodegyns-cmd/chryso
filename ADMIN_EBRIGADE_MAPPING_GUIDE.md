# 🔧 Guide: Associer Des Codes eBrigade Aux Activités

## 📋 Le Système Maintenant

- Chaque activité (ex: "Permanence INFI", "Ambulance SSCR-MED") peut être associée à un ou plusieurs codes eBrigade
- Quand un utilisateur déclare des heures sur une prestation eBrigade, le système cherche le code de cette prestation
- Si le code est associated à une activité, il utilise les tarifs de cette activité ✅
- Si le code n'est pas associated, il utilise les tarifs par défaut/fallback ❌

---

## 🎯 Comment Associer Des Codes (Admin)

### 1️⃣ Accéder à l'Admin
```
Admin → Activités → [Click Edit sur une activité]
```

### 2️⃣ Section "Associer à des analytiques eBrigade"
Un formulaire avec des cases à cocher apparaît:
```
☐ 9395 — Permanence INFI | 14h-21h
☑ 9610 — Permanence INFI | 07h-14h
☐ 9610b — Permanence INFI (variante)
☐ 9402 — Permanence INFI (ancienne)
```

### 3️⃣ Cocher Les Codes Pertinents
- Marquer les codes qui correspondent à cette activité
- Tous les codes cochés auront les mêmes tarifs

### 4️⃣ Enregistrer
- Click "Créer" ou "Mettre à jour"
- Les codes sont maintenant mappés!

---

## ✅ État Actuel

### Activité #4: Permanence INFI
- ✓ Codes mappés: **9395, 9610, 9610b**
- Tarifs: 40.25€/h (Garde), 53€/h (Med)
- **Test réussi:** 7h × 40.25€ = **281.75€** ✅

### Activité #5, #6, #7, etc.
- ❌ **AUCUN CODE MAPPÉ**
- Si l'utilisateur déclare des heures sur ces codes → **Fallback 20€/30€** ❌

---

## 📊 Prochaines Étapes

1. **Identifier tous les codes eBrigade** disponibles pour chaque activité
2. **Éditer chaque activité** et cocher les codes correspondants
3. **Tester** en déclarant des heures sur chaque code

---

## 🐛 Dépannage

### Les checkboxes affichent juste "—" ?
- Hard refresh du navigateur (Ctrl+Shift+R)
- Les codes doivent maintenant s'afficher correctement

### Un code n'apparaît pas dans les checkboxes ?
- Le code doit d'abord être retourné par l'API eBrigade
- Assurez-vous que le code a été déclaré au moins une fois dans la plage de 30-90 jours

### Estimation toujours au fallback après mappagem?
- Vérifier que le code est bien enregistré dans la base:
  - Script: `node scripts/check-mappings.js`
  - Affichera les codes associés à chaque activité

---

## 💡 Format Des Codes

Les codes eBrigade sont des **numéros 4 chiffres**:
- 9610 = Permanence INFI
- 9395 = Permanence INFI (variante)
- 9336 = Permanence INFI (ancien code)
- etc.

Ne pas confondre avec les descriptions comme "Permanence INFI | 14h -21h" qui incluent les horaires.

---

## 🎯 Objectif Final

```
User déclare heures sur prestation eBrigade (code 9610)
         ↓
Dashboard → PrestationsTable → estimate.js
         ↓
estimate.js: "Je cherche le code 9610 dans activity_ebrigade_mappings"
         ↓
Trouvé! → activity_id=4 → Tarifs CORRECTS (40.25€, pas 20€ fallback)
         ↓
Résultat: 7 heures = 281.75€ ✅
```

Si le code n'était pas mappé:
```
Code 9610 non trouvé dans activity_ebrigade_mappings
         ↓
Fallback #1: analytic_id lookup
Fallback #2: analytic_code lookup  
Fallback #3: analytic_name lookup
         ↓
Résultat: 7 heures = 140€ (20€ fallback) ❌
```

---

## 📞 Contact

Si vous ne voyez pas les codes eBrigade à cocher:
1. Vérifierque le formulaire "Associer ..." s'affiche
2. Vérifier que les codes s'affichent (pas juste des tirets)
3. Contacter support si les codes n'apparaissent pas
