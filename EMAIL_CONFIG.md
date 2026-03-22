# Configuration des Emails pour Production

## Résumé de la fonctionnalité

L'application Chryso envoie automatiquement :
1. **Email de bienvenue** quand un admin crée un nouvel utilisateur (avec mot de passe temporaire)
2. **Email de confirmation** quand un utilisateur change son mot de passe

## Configuration pour Vercel (RECOMMANDÉE : one.com)

L'application est configurée pour utiliser **one.com** avec l'adresse `no-reply@sirona-consult.be`.

### Étapes de configuration one.com :

1. **Va sur** https://vercel.com/projects → Chryso → Settings → Environment Variables

2. **Ajoute ces variables d'environnement :**

```
EMAIL_PROVIDER=smtp
SMTP_HOST=send.one.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=no-reply@sirona-consult.be
SMTP_PASSWORD=[TON_MOT_DE_PASSE_ONE_COM]
SMTP_FROM=no-reply@sirona-consult.be
APP_NAME=Chryso
APP_URL=https://www.sirona-consult.be
```

3. **Comment trouver le mot de passe one.com :**
   - Va sur https://one.com/admin (espace client)
   - Menu Email → Gérer mes domaines → sirona-consult.be
   - Clique sur no-reply@sirona-consult.be
   - Cherche "Paramètres SMTP" ou "Mot de passe pour email"
   - Si tu ne trouves pas, tu peux réinitialiser le mot de passe depuis le panel one.com
   - Copie le mot de passe et mets-le dans SMTP_PASSWORD

4. **Teste en local :** Ajoute également le password dans `.env` localement pour tester

5. **Sauve dans Vercel** et attends le redéploiement (quelques secondes)

## Test local

Pour tester la configuration one.com en local :

1. Modifie `.env` et ajoute le mot de passe one.com :
```
EMAIL_PROVIDER=smtp
SMTP_HOST=send.one.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=no-reply@sirona-consult.be
SMTP_PASSWORD=ton-mot-de-passe-one-com
SMTP_FROM=no-reply@sirona-consult.be
```

2. Lance `npm run dev`

3. Crée un nouvel utilisateur via l'API ou le panel admin pour tester

4. L'email sera envoyé réellement si les paramètres sont corrects

## Autres options d'email

### Option 1 : Gmail

```
EMAIL_PROVIDER=gmail
GMAIL_USER=your-email@gmail.com
GMAIL_PASSWORD=xxxx xxxx xxxx xxxx
APP_NAME=Chryso
APP_URL=https://www.sirona-consult.be
```

**Comment obtenir le mot de passe Gmail :**
1. Active 2FA sur ton compte Google : https://myaccount.google.com/security
2. Va sur https://myaccount.google.com/apppasswords
3. Sélectionne "Mail" et "Windows Computer"
4. Copie le mot de passe généré (16 caractères)
5. Colle-le dans GMAIL_PASSWORD (attention aux espaces)

### Option 2 : SendGrid (gratuit, 100 emails/jour)

```
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxx
APP_NAME=Chryso
APP_URL=https://www.sirona-consult.be
```

**Comment obtenir la clé SendGrid :**
1. Inscris-toi sur https://sendgrid.com (gratuit)
2. Va sur Account → API Keys
3. Crée une nouvelle clé avec accès "Restricted" → Mail Send → Full Access
4. Copie la clé

### Option 3 : SMTP personnalisé (Office 365, etc)

```
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=admin@company.com
SMTP_PASSWORD=your-password
SMTP_FROM=noreply@company.com
APP_NAME=Chryso
APP_URL=https://www.sirona-consult.be
```

## Notes de sécurité

⚠️ **IMPORTANT :**
- Ne laisse JAMAIS le mot de passe dans `.env` en production (utilise Vercel)
- Les variables d'environnement Vercel sont chiffrées et sécurisées
- Change le mot de passe one.com régulièrement
- L'adresse no-reply@sirona-consult.be doit être configurée en tant que compte email dans one.com
- Ne met pas les credentials sensibles dans le code ou les commits

## Dépannage

### ⚠️ PROBLÈME CRITIQUE : Les emails vont au SPAM

**La raison principale :** Les records DNS pour **SPF**, **DKIM** et **DMARC** ne sont pas configurés !

Ce sont les records DNS qui authentifient tes emails. Sans eux, les fournisseurs email (Gmail, Outlook, etc) marquent tes emails comme suspects.

### Solution : Configurer SPF/DKIM/DMARC chez one.com

#### 1. **Configurer SPF** (le plus important)

Chez **one.com** :
1. Va sur https://one.com/admin
2. Menu **Domaines** → sirona-consult.be → **DNS**
3. Crée un record texte avec:
   - **Nom**: `sirona-consult.be` (ou laisse vide selon l'interface)
   - **Type**: TXT
   - **Valeur**: `v=spf1 include:sendmail.one.com ~all`

Cela dit aux serveurs email : "Les emails de sendmail.one.com sont autorisés pour ce domaine"

#### 2. **Configurer DKIM** (fortement recommandé)

One.com **génère généralement DKIM automatiquement** pour les emails:
1. Va dans les paramètres non-reply@sirona-consult.be chez one.com
2. Cherche "DKIM" ou "Clé DKIM"
3. S'il n'est pas activé, active-le et copie la clé publique
4. Crée un record DNS TXT chez one.com avec cette clé (one.com guide toi normalement)

#### 3. **Configurer DMARC** (recommandé)

Crée un record DNS TXT chez one.com:
   - **Nom**: `_dmarc.sirona-consult.be`
   - **Type**: TXT
   - **Valeur**: `v=DMARC1; p=quarantine; rua=mailto:admin@sirona-consult.be`

Cela dit: "Les emails non-authentifiés vont en quarantine, envoie moi un rapport"

### ✅ Vérifier que c'est configuré

1. Va sur https://mxtoolbox.com
2. Tape `sirona-consult.be`
3. Clique sur **Check SPF** → devrait montrer: "Syntax OK"
4. Clique sur **Check DKIM** → devrait montrer: "Public Key Found"
5. Clique sur **Find DMARC** → devrait montrer ton record DMARC

### Résumé des changements de code

Le code `emailService.js` a été amélioré avec:
- ✅ Headers MIME corrects (Content-Type, MIME-Version)
- ✅ Headers anti-spam (Precedence: bulk, List-Unsubscribe)
- ✅ X-Mailer identifié correctement
- ✅ Templates HTML bien formatés et validés
- ✅ Adresses email corrigées (`no-reply@` au lieu de `noreply@`)

Mais **l'étape DNS (SPF/DKIM/DMARC) est OBLIGATOIRE** pour que les emails ne vont pas au spam !

---

## Dépannage

### "SMTP not configured - logged to console only"
→ Tu n'as pas configuré SMTP_HOST, SMTP_USER, ou SMTP_PASSWORD dans Vercel

### "Invalid credentials" ou erreur d'authentification
→ Vérifies que le mot de passe one.com est correct

### "Unable to connect to SMTP server"
→ Vérifie que smtp.one.com et le port 587 sont accessibles (peut être un problème firewall)

### Emails n'arrivent pas
1. Vérifies le spam/courrier indésirable
2. Regarde les logs Vercel (Deployments → current → see logs)
3. Assure-toi que l'email no-reply@sirona-consult.be existe dans one.com
4. Teste d'abord en local pour isoler le problème

## Personnalisation des templates

Les templates d'email sont dans `services/emailService.js`.

Tu peux modifier :
- Le contenu HTML des emails
- Les styles CSS
- Le sujet de l'email
- Le texte alternatif plain text
- L'adresse "from" (via SMTP_FROM)
