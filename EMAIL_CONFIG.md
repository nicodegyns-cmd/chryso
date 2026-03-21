# Configuration des Emails pour Production

## Résumé de la fonctionnalité

L'application Chryso envoie maintenant automatiquement :
1. **Email de bienvenue** quand un admin crée un nouvel utilisateur (avec mot de passe temporaire)
2. **Email de confirmation** quand un utilisateur change son mot de passe

## Configuration pour Vercel

Pour activer l'envoi d'emails en production, tu dois configurer les variables d'environnement dans Vercel.

### Étapes :

1. **Va sur** https://vercel.com/projects → Chryso → Settings → Environment Variables

2. **Choisis une méthode :**

#### Option 1 : Gmail (plus simple)

Ajoute ces variables d'environnement :

```
EMAIL_PROVIDER = gmail
GMAIL_USER = to-email@gmail.com
GMAIL_PASSWORD = xxxx xxxx xxxx xxxx
APP_NAME = Chryso
APP_URL = https://www.sirona-consult.be
```

**Comment obtenir le mot de passe Gmail :**
1. Active 2FA sur ton compte Google : https://myaccount.google.com/security
2. Va sur https://myaccount.google.com/apppasswords
3. Sélectionne "Mail" et "Windows Computer"
4. Copie le mot de passe généré (16 caractères)
5. Colle-le dans GMAIL_PASSWORD (fais attention aux espaces)

#### Option 2 : SendGrid (meilleur pour production)

SendGrid offre 100 emails/jour gratuits (suffisant pour une petite app).

```
EMAIL_PROVIDER = sendgrid
SENDGRID_API_KEY = SG.xxxxxxxxxxxxxxxxxxxxx
APP_NAME = Chryso
APP_URL = https://www.sirona-consult.be
```

**Comment obtenir la clé SendGrid :**
1. Inscris-toi sur https://sendgrid.com (compte gratuit)
2. Va sur Account → API Keys
3. Crée une nouvelle API Key avec accès "Restricted" → Mail Send → Full Access
4. Copie la clé

#### Option 3 : SMTP personnalisé (ex: Office 365, serveur d'entreprise)

```
EMAIL_PROVIDER = smtp
SMTP_HOST = smtp.office365.com
SMTP_PORT = 587
SMTP_SECURE = false
SMTP_USER = admin@company.com
SMTP_PASSWORD = your-password
SMTP_FROM = noreply@company.com
APP_NAME = Chryso
APP_URL = https://www.sirona-consult.be
```

## Test local

En développement (yarn dev), si tu n'as pas configuré les emails, ils s'affichent dans la console au lieu d'être envoyés.

Pour tester avec Gmail localement :
1. Modifie `.env` :
```
EMAIL_PROVIDER=gmail
GMAIL_USER=ton-email@gmail.com
GMAIL_PASSWORD=xxxx xxxx xxxx xxxx
```

2. Lance `npm run dev`
3. Crée un nouvel utilisateur via le panel admin
4. Tu verras le mot de passe généré dans la réponse API ET un email sera envoyé

## Variables à ajouter dans Vercel

Minimum (pour logs en console) :
```
APP_NAME = Chryso
APP_URL = https://www.sirona-consult.be
```

Avec Gmail :
```
EMAIL_PROVIDER = gmail
GMAIL_USER = your-email@gmail.com
GMAIL_PASSWORD = xxxx xxxx xxxx xxxx
APP_NAME = Chryso
APP_URL = https://www.sirona-consult.be
```

## Notes de sécurité

⚠️ **IMPORTANT :**
- Ne mets JAMAIS les tokens/passwords danale code source
- Les variables d'environnement Vercel sont chiffrées et sécurisées
- Si tu utilises Gmail, crée un compte dédié ou utilise un alias
- Le mot de passe Gmail est un "App Password", pas ton vrai mot de passe

## Dépannage

### "SMTP not configured - logged to console only"
→ Tu n'as pas configuré EMAIL_PROVIDER, GMAIL_USER, ou SENDGRID_API_KEY

### "Invalid credentials" ou "530 5.7.0 Must issue a STARTTLS command first"
→ Vérifies que le mot de passe Gmail est correct et qu'il s'agit bien d'un App Password

### Emails n'arrivent pas
1. Vérifies le spam/courrier indésirable
2. Regarde les logs dans Vercel (Deployments → current → see logs)
3. Essaie d'ajouter "APP_URL=https://www.sirona-consult.be" si c'est manquant

## Personnalisation des templates

Les templates d'email sont dans `services/emailService.js`.
Tu peux modifier :
- Le contenu HTML
- Les styles CSS
- Le sujet de l'email
- Les adresses "from"
