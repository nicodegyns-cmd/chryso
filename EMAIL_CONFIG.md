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
SMTP_HOST=smtp.one.com
SMTP_PORT=587
SMTP_SECURE=false
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
SMTP_HOST=smtp.one.com
SMTP_PORT=587
SMTP_SECURE=false
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
