# 🔧 Configuration des Variables Vercel

## Problème: Les emails d'invitation utilisent `http://localhost:3000`

Lorsque vous recevez une invitation par email, le lien est incorrect:
```
❌ http://localhost:3000/signup?token=...
✅ https://www.sirona-consult.be/signup?token=...
```

## Solution: Ajouter `NEXT_PUBLIC_APP_URL` à Vercel

### Étape 1: Via Vercel Dashboard

1. Allez sur [vercel.com/dashboard](https://vercel.com/dashboard)
2. Sélectionnez votre projet `chryso`
3. Allez dans **Settings** → **Environment Variables**
4. Cliquez **Add New**
5. Configurez:
   - **Name**: `NEXT_PUBLIC_APP_URL`
   - **Value**: `https://www.sirona-consult.be`
   - **Environments**: Sélectionnez **Production** (et Preview si vous voulez)
6. Cliquez **Add**

### Étape 2: Redéployer

Après avoir ajouté la variable:

1. Allez dans le **Deployments** tab
2. Cliquez le menu **...** à côté du déploiement actuel
3. Sélectionnez **Redeploy**
4. Attendez que le build soit terminé (2-3 minutes)

### Alternative: Via CLI

```bash
# Login to Vercel
vercel login

# Add environment variable
vercel env add NEXT_PUBLIC_APP_URL
# Entrez: https://www.sirona-consult.be

# Redeploy with new variables
vercel --prod
```

## Vérification

Après le redéploiement, testez:

1. Allez dans **Admin → Users**
2. Cliquez **Sélectionner individuellement**
3. Sélectionnez un utilisateur
4. Cliquez **Synchroniser sélectionnés**
5. Vérifiez l'email reçu - le lien doit être: `https://www.sirona-consult.be/signup?token=...`

## ⚠️ Important

- Cette variable **DOIT** être `NEXT_PUBLIC_*` (publique) car elle est utilisée dans les emails
- Elle est différente de `NEXT_PUBLIC_API_URL` (qui est pour les appels API)
- Elle doit inclure `https://` au début

## Variables d'environnement Vercel Actuelles

| Variable | Valeur | But |
|----------|--------|-----|
| `DATABASE_URL` | `postgresql://...` | Connexion PostgreSQL |
| `NEXT_PUBLIC_API_URL` | ✅ À configurer | URL API backend |
| `NEXT_PUBLIC_APP_URL` | ❌ **MANQUANTE** | URL app pour emails |
| `EBRIGADE_URL` | ✅ Configuré | API eBrigade |
| `EBRIGADE_TOKEN` | ✅ Configuré | Token eBrigade |
| `ADMIN_MIGRATION_TOKEN` | ✅ Configuré | Token migrations DB |
| `JWT_SECRET` | ✅ À configurer | Authentification |
| `GOOGLE_CLIENT_ID` | ✅ À configurer | OAuth Google |
| `GOOGLE_CLIENT_SECRET` | ✅ À configurer | OAuth Google |
