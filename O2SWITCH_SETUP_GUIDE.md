# Guide d'accès O2Switch - Configuration Email SPF/DKIM/DMARC

## 🔐 Accès au panneau O2Switch

### Étape 1: Se connecter au panneau de contrôle O2Switch

**Adresse**: https://www.o2switch.fr/client/

1. Cliquez sur **"Connexion"** (en haut à droite)
2. Entrez vos identifiants O2Switch:
   - **Email**: Votre email associé au compte O2Switch
   - **Mot de passe**: Votre mot de passe O2Switch
3. Cliquez sur **"Se connecter"**

> **Si vous oubliez vos identifiants**: https://www.o2switch.net/client/login/retrieve

---

## 📋 Navigation dans le panneau O2Switch

### 1️⃣ Accéder à la gestion DNS

Une fois connecté:

1. **Menu principal** → **"Domaines"** (ou "Mes domaines")
2. Sélectionnez votre domaine:
   - **sirona-consult.be** (pour SPF/DKIM/DMARC)
   - **nexio7.be** (si applicable)
3. Cliquez sur **"Gestion DNS"** ou **"Zones DNS"**

---

## 🔧 Configuration SPF (5 minutes)

### Localisation dans O2Switch:
**Domaines** → **[Votre domaine]** → **Gestion DNS** → **Ajouter un record**

### Comment ajouter le record SPF:

1. Cliquez sur **"Ajouter un record"** ou **"+"**
2. Remplissez les champs:
   ```
   Type:        TXT
   Nom:         @ (ou laisser vide)
   Contenu/Val: v=spf1 mx include:o2switch.net ~all
   TTL:         3600 (par défaut)
   ```
3. Cliquez sur **"Ajouter"** ou **"Valider"**

### Vérification:
```powershell
# Depuis PowerShell (après 1-24h)
nslookup -type=TXT sirona-consult.be

# Résultat attendu:
# "v=spf1 mx include:o2switch.net ~all"
```

---

## 🔐 Configuration DKIM (45 minutes)

### ⚠️ DKIM doit être demandé au support O2Switch

**Les étapes**:

### 1. Contacter le support O2Switch

**Option A - Ticket support (recommandé)**:
1. Allez dans **Domaines** → **[Votre domaine]** → **Support**
2. Cliquez sur **"Créer un ticket"**
3. **Sujet**: "Activation DKIM pour mon domaine"
4. **Message**:
```
Bonjour,

Je souhaiterais activer DKIM pour mon domaine: sirona-consult.be

Merci de générer les clés DKIM et de me fournir:
- Le DKIM Selector (par défaut ou custom)
- La clé publique (record TXT)
- Les instructions d'ajout au DNS

Cordialement,
[Votre nom]
```

**Option B - Téléphone**:
- Ligne: +33 (0) 9 72 37 94 46
- Horaires: Lundi-Vendredi, 08:00-20:00 (heure française)

**Option C - Email**:
- support@o2switch.net
- Mentionnez votre domaine: **sirona-consult.be**

### 2. O2Switch vous répondra avec:
```
Voici votre configuration DKIM:

Selector: default
Record TXT à ajouter:

Nom: default._domainkey.sirona-consult.be
Contenu: v=DKIM1; k=rsa; p=MIIB....[très longue clé]....==
```

### 3. Ajouter le record DKIM à votre DNS O2Switch:

1. Allez dans **Domaines** → **[Votre domaine]** → **Gestion DNS**
2. Cliquez sur **"Ajouter un record"**
3. Remplissez:
```
Type:        TXT
Nom:         default._domainkey
Contenu/Val: v=DKIM1; k=rsa; p=MIIB....[la clé complète]....==
TTL:         3600
```
4. Cliquez sur **"Ajouter"**

### 4. Vérification DKIM:
```powershell
# Après 24-48h de propagation DNS
nslookup -type=TXT default._domainkey.sirona-consult.be

# Résultat attendu: La clé DKIM complète
```

---

## 📊 Configuration DMARC (5 minutes)

### Localisation dans O2Switch:
**Domaines** → **[Votre domaine]** → **Gestion DNS** → **Ajouter un record**

### Comment ajouter le record DMARC:

1. Cliquez sur **"Ajouter un record"**
2. Remplissez les champs:
```
Type:        TXT
Nom:         _dmarc
Contenu/Val: v=DMARC1; p=reject; rua=mailto:admin@sirona-consult.be; ruf=mailto:admin@sirona-consult.be; fo=1; aspf=r; adkim=r
TTL:         3600
```
3. Cliquez sur **"Ajouter"**

### Explication des paramètres DMARC:
- `v=DMARC1` → Version DMARC
- `p=reject` → Rejette les emails en échec (strict)
- `rua=mailto:...` → Email pour rapports d'agrégation (hebdomadaire)
- `ruf=mailto:...` → Email pour rapports forensiques (détaillés)
- `fo=1` → Rapporter défaillances partielles
- `aspf=r` → SPF alignement relaxé
- `adkim=r` → DKIM alignement relaxé

### Vérification DMARC:
```powershell
# Après 1-24h
nslookup -type=TXT _dmarc.sirona-consult.be

# Résultat attendu:
# "v=DMARC1; p=reject; rua=mailto:admin@sirona-consult.be; ..."
```

---

## 🔍 Affichage et gestion des records DNS dans O2Switch

### Vue complète de tous les records:

1. **Domaines** → **[Votre domaine]** → **Gestion DNS** 
2. Vous verrez une **liste des records existants**:
   - Records MX (pour recevoir les emails)
   - Records A (pour l'adresse IP du site)
   - Records CNAME
   - Records TXT (SPF, DKIM, DMARC)

### Éditer un record existant:
- Cliquez sur le record → **"Modifier"** (ou crayon) → Changez le contenu → **"Valider"**

### Supprimer un record:
- Cliquez sur le record → **"Supprimer"** (ou corbeille) → Confirmez

---

## 📞 Support O2Switch Direct

### Accès au support dans le panneau:

1. **Menu** → **"Support"** ou **"Aide"**
2. Ou directement: https://www.o2switch.net/support

### Contact direct:
```
☎️  Téléphone: +33 (0) 9 72 37 94 46
📧 Email: support@o2switch.net
🌐 Chat: Disponible dans le panneau client
⏰ Heures: Lun-Ven 08:00-20:00 (heure France)
```

### Créer un ticket support:
1. Allez dans **Support** → **Créer un ticket**
2. Sélectionnez **Catégorie**: "Email" ou "DNS"
3. **Priorité**: "Normal" ou "Urgent"
4. **Décrivez votre problème** en détail
5. **Attachez les captures d'écran** si nécessaire

---

## ✅ Checklist de configuration complète

### Pour sirona-consult.be:

- [ ] **Accès au panneau O2Switch** ✓
  - Email: [votre email]
  - Mot de passe: [sauvegardé]

- [ ] **SPF Record ajouté** ✓
  - Domaine: sirona-consult.be
  - Type: TXT
  - Nom: @ (ou vide)
  - Valeur: v=spf1 mx include:o2switch.net ~all
  - ➜ Ticket/Email support O2Switch pour vérification

- [ ] **DKIM activé** ✓
  - Contacté support O2Switch
  - Reçu clé DKIM
  - Record TXT ajouté (default._domainkey)
  - ➜ Permet l'envoi signé d'emails

- [ ] **DMARC Record ajouté** ✓
  - Domaine: sirona-consult.be
  - Type: TXT
  - Nom: _dmarc
  - Valeur: v=DMARC1; p=reject; rua=mailto:admin...

- [ ] **Vérification DNS** ✓
  - SPF: ✓ Fonctionne
  - DKIM: ✓ Fonctionne
  - DMARC: ✓ Fonctionne

- [ ] **Tests de délivrabilité** ✓
  - MXToolbox: https://mxtoolbox.com
  - Google PostMaster: https://postmaster.google.com

---

## 🎯 Timeline recommandée

| Jour | Tâche | Durée |
|------|-------|-------|
| **Jour 1** | SPF Record ajouté | 5 min |
| **Jour 1** | Contacter O2Switch pour DKIM | 10 min |
| **Jour 2-3** | DKIM clé reçue & record ajouté | 10 min |
| **Jour 3** | DMARC Record ajouté | 5 min |
| **Jour 4-7** | Propagation DNS complète | - |
| **Jour 7** | Vérification finale | 10 min |
| **Jour 8+** | Monitoring des rapports | - |

---

## 🆘 Problèmes courants

### ❌ "Le record TXT ne s'ajoute pas"
- **Cause**: Format invalide ou domaine non correctement sélectionné
- **Solution**: Vérifiez les espaces, caractères spéciaux, domaine correct

### ❌ "O2Switch dit que DKIM n'est pas disponible"
- **Cause**: Pas d'accès DKIM pour ce type de compte
- **Solution**: Contactez le support, peut nécessiter un upgrade

### ❌ "Les emails vont toujours en spam"
- **Cause**: Raputation IP faible, contenu email suspect
- **Solution**: Vérifiez contenu HTML, images, liens; attendez 7-14 jours

### ❌ "Je ne reçois pas les rapports DMARC"
- **Cause**: Email admin@sirona-consult.be non accessible
- **Solution**: Changez l'email DMARC en email actif

---

## 📚 Ressources O2Switch

### [Lien direct vers O2Switch Panel](https://www.o2switch.fr/client/)
### [Documentation O2Switch Email](https://www.o2switch.net/)
### [FAQ O2Switch DNS](https://www.o2switch.net/help/)

---

## 💡 Conseils additionnels

1. **Nota bene**: O2Switch stocke vos records DNS - Il y a un délai de **24-48h** pour la propagation mondiale
2. **Sauvegarde**: Prenez des captures d'écran de votre configuration
3. **Monitoring**: Optez pour Google PostMaster Tools pour suivre la délivrabilité
4. **Test régulier**: Vérifiez vos records tous les 30 jours

---

## 📞 Qui contacter en cas de problème?

**Problem**: ❌ Je ne peux pas accéder au panneau O2Switch
**Solution**: Contactez support@o2switch.net avec votre ID client

**Problem**: ❌ Je n'arrive pas à ajouter un record TXT
**Solution**: Créez un ticket dans "Support" du panneau O2Switch

**Problem**: ❌ O2Switch refuse de configurer DKIM
**Solution**: Demandez un upgrade du compte ou changez de provider email

**Problem**: ❌ Les emails vont toujours en dossier spam après configuration
**Solution**: 1. Attendez 7 jours 2. Vérifiez contenu HTML 3. Test MXToolbox

