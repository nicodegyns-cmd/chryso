# 📧 Fix Email Deliverability - Configuration DNS Requise

## Problem
Les emails de Fénix arrivent dans les dossiers **spam** car les serveurs de réception ne peuvent pas vérifier l'authentification de l'expéditeur `fenix@nexio7.be`.

## Solution

### Step 1: Ajouter SPF Record (CRITIQUE ⚠️)

**Via ton gestionnaire DNS** (OVH, Infomaniak, etc.), ajoute ce record DNS:

**Type:** TXT  
**Nom/Host:** `nexio7.be` (ou `@`)  
**Valeur:**
```
v=spf1 include:o2switch.net ~all
```

**Si tu as déjà un SPF record**, ajoute `include:o2switch.net` au record existant:
```
v=spf1 include:o2switch.net include:_spf.google.com ~all
```

### Step 2: Configurer DKIM (Recommandé)

O2Switch doit te fournir une clé DKIM. Demande à O2Switch:
- "Je veux configurer DKIM pour fenix@nexio7.be via O2Switch SMTP"
- Ils vont te fournir:
  - **Sélecteur:** (ex: "default" ou "o2switch")
  - **Clé publique DKIM**

Puis ajoute un record TXT:
```
Type: TXT
Nom: default._domainkey.nexio7.be  (ou [selector]._domainkey.nexio7.be)
Valeur: v=DKIM1; k=rsa; p=[la clé publique O2Switch]
```

### Step 3: DMARC (Optionnel)

Pour une meilleure protection, ajoute:

**Type:** TXT  
**Nom:** `_dmarc.nexio7.be`  
**Valeur:**
```
v=DMARC1; p=none; rua=mailto:admin@nexio7.be; fo=1
```

## Vérification

Une fois configuré, teste avec:
```bash
# Check SPF
nslookup -q=TXT nexio7.be
# Doit retourner: v=spf1 include:o2switch.net ~all

# Check DKIM (une fois configuré)
nslookup -q=TXT default._domainkey.nexio7.be
```

## Timeline

SPF prend effet immédiatement (quelques secondes-minutes)  
DKIM prend effet aussi assez vite (quelques minutes)  
DMARC peut prendre quelques heures

## Après la Config

Les emails devraient maintenant:
✅ Être reconnus comme authentiques  
✅ Aller dans l'inbox au lieu du spam  
✅ Afficher un ✅ vert dans le client mail  

## Support

Si tu n'as pas accès aux DNS records:
- Contact ton registrar (Gandi, Ionos, etc.)
- Contact ton hébergeur (Infomaniak, OVH, etc.)
- Donne-leur exactement les records à ajouter ci-dessus

---

**Important:** Sans SPF record, 90% des emails vont en spam. C'est la priorité #1!
