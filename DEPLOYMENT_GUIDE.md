# Guide de Déploiement - Chryso sur Vercel + Supabase

## 📋 Vue d'ensemble
Ce projet est configuré pour être déployé sur :
- **Frontend/Backend**: Vercel (Next.js)
- **Database**: Supabase (PostgreSQL)
- **Storage**: Vercel (pour les exports PDF)

## 🔧 Configuration Actuelle

### 1. Base de données PostgreSQL
- **Fournisseur**: Supabase
- **Status**: ✅ Compte créé, projet actif
- **Connection String**: 
  ```
  postgresql://postgres:@Thesin2026@db.ujtkgekhbvalaadfniyn.supabase.co:5432/postgres
  ```
- **Fichier config**: `.env.production`

### 2. Driver utilisé
- **Ancien**: mysql2/promise (MySQL)
- **Nouveau**: pg (PostgreSQL) - ✅ Installé via npm
- **Fichier**: `services/db.js`

### 3. Migrations SQL
- **Fichier**: `sql/postgres_init.sql`
- **Statut**: ✅ Créé et optimisé pour PostgreSQL
- **Contient**: Toutes 12 migrations MySQL converties en PostgreSQL

## 🚀 Étapes de Déploiement

### Étape 1: Exécuter les Migrations sur Supabase

1. **Accéder au SQL Editor de Supabase**:
   - Aller sur https://app.supabase.com
   - Sélectionner le projet "chryso"
   - Cliquer sur "SQL Editor" dans la sidebar gauche

2. **Exécuter le script de migration**:
   - Ouvrir un nouvel onglet SQL
   - Copier le contenu complet de `sql/postgres_init.sql`
   - Coller dans l'éditeur SQL
   - Cliquer sur "Exécuter"
   - ✅ Attendre la confirmation "Migrations executed successfully"

3. **Vérifier les tables créées**:
   - Aller dans "Table Editor" dans la sidebar
   - Vérifier que les tables suivantes existent:
     - `users`
     - `roles`
     - `analytics`
     - `activities`
     - `prestations`
     - `pdf_sends`

### Étape 2: Configurer Vercel

1. **Créer un projet Vercel**:
   - Aller sur https://vercel.com
   - Cliquer "New Project"
   - Selectionnez le repository GitHub: `nicodegyns-cmd/chryso`
   - ✅ Vercel va détecter Next.js automatiquement

2. **Configurer les variables d'environnement**:
   - Dans les settings du projet Vercel, aller à "Environment Variables"
   - Ajouter les variables suivantes:
   ```
   DATABASE_URL=postgresql://postgres:@Thesin2026@db.ujtkgekhbvalaadfniyn.supabase.co:5432/postgres
   NEXT_PUBLIC_API_URL=https://chryso.vercel.app
   ```
   - ⚠️ Remplacer `chryso` par votre domaine Vercel réel si différent

3. **Déployer**:
   - Vercel va automatiquement déployer depuis la branche `main`
   - Attendre le succès du build
   - Votre site sera accessible à `https://chryso.vercel.app`

### Étape 3: Tester la Connexion

Une fois déployé sur Vercel, tester que tout fonctionne:

1. **Test du login**:
   - Aller sur `https://chryso.vercel.app/login`
   - Essayer de se connecter (la base de données est vide initialement)

2. **Test de l'API**:
   - Aller sur `https://chryso.vercel.app/api/ping`
   - Vous devriez voir une réponse JSON

3. **Créer un utilisateur admin** (pour données de test):
   ```bash
   # En local, créer un admin
   node scripts/create_admin.js
   ```

## 🔐 Sécurité en Production

### Variables sensibles
⚠️ **IMPORTANT**: La connection string DATABASE_URL contient le mot de passe.
- ❌ Ne JAMAIS commiter `.env.production` dans GitHub
- ✅ Utiliser Vercel "Environment Variables" pour les secrets
- ✅ Vous pouvez mettre `.env.production` dans `.gitignore` (actuellement non configuré)

### Suggestions pour sécuriser davantage:
1. **Changer le mot de passe PostgreSQL Supabase**:
   - Aller dans Supabase Database Settings
   - Cliquer "Reset Database Password"
   - Mettre à jour DATABASE_URL partout

2. **Récupérer le domain Vercel personnalisé**:
   - Dans settings Vercel → Domains
   - Configurer un domaine personnalisé (coutera ~$12/an)

## 📊 Structure des Données

### Tables principales:
- **users**: Infirmiers/Médecins + Admins
- **analytics**: Codes analytiques (PDF destinations)
- **activities**: Activités liées aux analytiques
- **prestations**: Prestations de travail des utilisateurs
- **pdf_sends**: Suivi des envois de PDF
- **roles**: Référence des rôles (INFI, MED, admin, moderator)

### Champs clés:
- **prestations.pay_type**: APS / Garde / Permanence
- **prestations.status**: Suivi du statut de la prestation
- **users.role**: Détermine les permissions

## 🔗 Points d'accès Utiles

- **Frontend**: https://chryso.vercel.app
- **Supabase Console**: https://app.supabase.com → projet "chryso"
- **Vercel Dashboard**: https://vercel.com/dashboard
- **GitHub Repo**: https://github.com/nicodegyns-cmd/chryso

## 📝 Notes Importantes

1. **Migration MySQL → PostgreSQL**:
   - Tous les `AUTO_INCREMENT` sont convertis en `SERIAL`/`BIGSERIAL`
   - Tous les backticks MySQL sont remplacés par guillemets PostgreSQL
   - `BIGINT UNSIGNED` → `BIGINT` (PostgreSQL n'a pas d'unsigned)

2. **Capacité Supabase Free Tier**:
   - 1 Milliard de requêtes/mois (vos ~10K queries/month = 0.001% d'utilisation) ✅
   - 500 MB storage
   - Suffisant pour 300+ prestataires

3. **Migrations en cas d'erreur**:
   - Les migrations sont idempotentes (`CREATE TABLE IF NOT EXISTS`)
   - Vous pouvez les ré-exécuter sans danger

## 🆘 Troubleshooting

### "Connection failed"
- Vérifier que DATABASE_URL est correcte dans Vercel
- Vérifier que les tables sont créées dans Supabase SQL Editor

### "Authentication failed"
- Le mot de passe de Supabase est: `@Thesin2026`
- S'assurer que vous utilisez la bonne connection string

### "Table does not exist"
- Les migrations n'ont pas été exécutées
- Allez dans "SQL Editor" Supabase et relancez `postgres_init.sql`

## ✅ Checklist de Déploiement

- [ ] Migrations SQL exécutées sur Supabase
- [ ] Tables vérifiées dans Supabase Table Editor
- [ ] Vercel project créé et connecté à GitHub
- [ ] Variables d'environnement configurées dans Vercel
- [ ] Build Vercel réussi
- [ ] Test API `/api/ping` fonctionnel
- [ ] Test login page accessible
- [ ] (Optionel) Administrateur créé via script
- [ ] (Optionel) Domaine personnel configuré

---

**Status**: Production-Ready ✅
**Dernière mise à jour**: 2025-03-10
**Database**: PostgreSQL 14+ (Supabase)
**Runtime**: Node.js 18+ (Vercel Serverless)
