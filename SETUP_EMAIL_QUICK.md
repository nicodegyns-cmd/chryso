# 🚀 Configuration Rapide : Email one.com sur Vercel

## C'est quoi ?
L'application envoie maintenant automatiquement des emails lors :
- ✅ Création d'utilisateur (avec mot de passe temporaire)
- ✅ Changement de mot de passe (email de confirmation)

## Configuration en 3 étapes

### 1️⃣ Trouver le mot de passe one.com

1. Va sur **https://one.com/admin** (espace client)
2. Va dans **Email** → **Gérer mes domaines**
3. Trouve et clique sur **sirona-consult.be**
4. Clique sur **no-reply@sirona-consult.be**
5. Cherche **"Paramètres SMTP"** ou **"Mot de passe pour email"**
   - Si tu ne vois pas le mot de passe, clique sur "Réinitialiser le mot de passe"
6. Copie le mot de passe généré

### 2️⃣ Ajouter dans Vercel

1. Va sur **https://vercel.com/projects**
2. Clique sur **Chryso**
3. Va dans **Settings** → **Environment Variables**
4. Ajoute ces 9 variables :

```
NAME                VALUE
EMAIL_PROVIDER      smtp
SMTP_HOST           send.one.com
SMTP_PORT           465
SMTP_SECURE         true
SMTP_USER           no-reply@sirona-consult.be
SMTP_PASSWORD       [Le mot de passe copié d'étape 1]
SMTP_FROM           no-reply@sirona-consult.be
APP_NAME            Chryso
APP_URL             https://www.sirona-consult.be
```

5. Clique **Save**
6. Vercel redéploiera automatiquement (2-3 secondes)

### 3️⃣ Tester

Une fois déployé :
1. Va sur https://www.sirona-consult.be/login
2. Connecte-toi comme admin (nicodegyns@gmail.com / 1234)
3. Va dans **Admin Panel** → **Utilisateurs** → **Créer un utilisateur**
4. Va un nouvel utilisateur
5. Un email devrait être envoyé à cet utilisateur avec son mot de passe temporaire

## ✨ C'est tout !

Les emails s'enverront maintenant :
- **Immédiatement** lors de la création d'un utilisateur
- **Automatiquement** au changement de mot de passe
- **Depuis** no-reply@sirona-consult.be

## ❓ Ça ne marche pas ?

### Email pas reçus ?
- ✅ Vérifies le spam/courrier indésirable
- ✅ Assure-toi que le mot de passe one.com est correct
- ✅ Va voir les logs Vercel : https://vercel.com/projects/chryso → Deployments → current → Logs

### Erreur "Invalid credentials" ?
- Le mot de passe one.com est peut-être incorrect
- Réessaie de trouver/réinitialiser le mot de passe dans le panel one.com

### Autre problème ?
- Regarde [EMAIL_CONFIG.md](./EMAIL_CONFIG.md) pour plus de détails et des solutions

## 🔒 Sécurité

Les variables d'environnement Vercel sont **chiffrées** et **sécurisées**. Le mot de passe n'est jamais
stocké localement ni dans Git.
