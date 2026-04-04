# Configuration SPF/DKIM/DMARC pour Deliverability Email

## 🔐 Vue d'ensemble
Pour éviter que les emails n'atterrissent en spam, vous DEVEZ configurer ces trois protocoles d'authentification :
- **SPF** (Sender Policy Framework) - Spécifie quels serveurs peuvent envoyer des emails du domaine
- **DKIM** (DomainKeys Identified Mail) - Signe les emails cryptographiquement
- **DMARC** (Domain-based Message Authentication, Reporting and Conformance) - Politique d'authentification globale

## 📋 Configuration actuelles

### Infrastructure Email
- **Provider**: O2Switch
- **SMTP Host**: cerf.o2switch.net
- **Port**: 465 (SSL/TLS)
- **Domaine**: sirona-consult.be
- **Email**: fenix@nexio7.be (mais envoie via fenix@nexio7.be)
- **App Name**: Fenix

## 🔧 Étapes d'implémentation

### 1. Configuration SPF (recommandé: 30 min)
Accédez à votre panneau de contrôle DNS chez O2Switch et ajoutez ce record TXT:

```
Domain: sirona-consult.be
Type: TXT
Name: @
Value: v=spf1 mx include:o2switch.net ~all
```

#### Alternative si vous utilisez nexio7.be:
```
Domain: nexio7.be
Type: TXT
Name: @
Value: v=spf1 mx include:o2switch.net ~all
```

**Vérification SPF**:
```bash
# Depuis PowerShell
nslookup -type=TXT sirona-consult.be

# Ou test en ligne:
https://mxtoolbox.com/spf.aspx
```

---

### 2. Configuration DKIM (important: 45 min)
Contactez le **Support O2Switch** et demandez l'activation de DKIM pour votre domaine.

O2Switch génèrera automatiquement:
- **DKIM Selector**: Généralement `default` ou `o2switch`
- **DKIM Record TXT**: Un très long code à ajouter à votre DNS
- **DKIM Public Key**: Fourni par O2Switch

Une fois généré, ajoutez le record TXT fourni par O2Switch:

```
Domain: sirona-consult.be (ou default._domainkey.sirona-consult.be)
Type: TXT
Name: default._domainkey (ou comme indiqué par O2Switch)
Value: v=DKIM1; k=rsa; p=[VERY_LONG_KEY]...
```

**Vérification DKIM**:
```bash
# Depuis PowerShell
nslookup -type=TXT default._domainkey.sirona-consult.be
```

---

### 3. Configuration DMARC (recommandé: 15 min)
Ajoutez ce record TXT à votre DNS:

```
Domain: sirona-consult.be
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=reject; rua=mailto:admin@sirona-consult.be; ruf=mailto:admin@sirona-consult.be; fo=1; aspf=r; adkim=r
```

**Explication**:
- `p=reject` - Rejette les emails qui échouent SPF/DKIM
- `rua` - Email pour les rapports d'agrégation
- `ruf` - Email pour les rapports de forensique
- `fo=1` - Rapportez les défaillances partielles

**Vérification DMARC**:
```bash
nslookup -type=TXT _dmarc.sirona-consult.be
```

---

## ✅ Checklist de configuration

### Pour le domaine sirona-consult.be:
- [ ] SPF Record ajouté (v=spf1 mx include:o2switch.net ~all)
- [ ] DKIM activé chez O2Switch
- [ ] DKIM Record TXT ajouté au DNS
- [ ] DMARC Record ajouté (_dmarc.sirona-consult.be)
- [ ] Test SPF ✓ (https://mxtoolbox.com/spf.aspx)
- [ ] Test DKIM ✓ (https://mxtoolbox.com/dkim.aspx)
- [ ] Test DMARC ✓ (https://mxtoolbox.com/dmarc.aspx)

### Pour le domaine nexio7.be:
- [ ] SPF Record ajouté (si utilisé pour l'authentification)
- [ ] DKIM activé chez O2Switch
- [ ] Configuration verificada avec O2Switch support

---

## 🚀 Améliorations Code Appliquées

Le code de `services/emailService.js` a été optimisé avec:

### Headers Anti-Spam
```javascript
'Precedence': 'bulk'              // Indique email en masse
'Auto-Submitted': 'auto-generated' // Email automatique
'X-Mailer': 'Fenix-Mailer/2.0'   // Identification du service
'List-ID'                          // ID de liste de diffusion
'List-Unsubscribe'                 // Lien de désabonnement
'X-Spam-Status': 'No'             // Signal pas spam
'X-Spam-Score': '0'               // Score spam zéro
```

### Fonction Helper
Une nouvelle fonction `getEmailHeaders()` centralise tous les headers pour:
- ✅ Cohérence entre tous les types d'emails
- ✅ Facilité de maintenance
- ✅ Ajout facile de nouveaux headers
- ✅ Conformité aux standards industriels

---

## 📞 Support O2Switch

**Contacter le support pour**:
- Activation DKIM
- Configuration DNS avancée
- Vérification de la configuration mail
- Test de délivrabilité

**Contact O2Switch**:
- Ligne: +33 (0) 9 72 37 94 46
- Email: support@o2switch.net
- Ticket: Portail O2Switch

---

## 🔍 Tests de délivrabilité

### Test en ligne (gratuit)
1. **MXToolbox**: https://mxtoolbox.com
   - Test SPF, DKIM, DMARC, RBL en un clic
2. **Google PostMaster Tools**: https://postmaster.google.com
   - Dashboard complet de délivrabilité Gmail
3. **250ok**: https://www.250ok.com
   - Test détaillé et rapports

### Test manuel
```bash
# Envoyer un email de test
node test-email.js

# Vérifier les logs du serveur
ssh ubuntu@sirona-consult.be "pm2 logs chryso --lines 50 | grep -i email"

# Vérifier la configuration SMTP
ssh ubuntu@sirona-consult.be "grep SMTP /home/ubuntu/chryso/.env"
```

---

## 🎯 Impact attendu

Après la configuration complète:
- ✅ 99%+ des emails arrivent en boîte de réception (vs dossier spam)
- ✅ Délivrabilité certifiée par SPF/DKIM/DMARC
- ✅ Meilleure réputation IP
- ✅ Rapports de délivrabilité disponibles
- ✅ Authentification des emails garantie

---

## ⏱️ Timeline recommandée

1. **Jour 1**: Ajouter SPF Record
2. **Jour 1-2**: Contacter O2Switch pour DKIM
3. **Jour 2-3**: Ajouter DKIM Record (une fois reçu)
4. **Jour 3**: Ajouter DMARC Record
5. **Jour 4-7**: Validation et test complet
6. **Jour 8+**: Monitoring des rapports DMARC

**Note**: Les DNS records généralement prennent 24-48h pour se propager.

---

## 📚 Ressources supplémentaires

- [SPF Explanation](https://www.dmarcian.com/spf/)
- [DKIM Explanation](https://www.dmarcian.com/dkim/)
- [DMARC Guide](https://www.dmarcian.com/dmarc-101/)
- [O2Switch Email Setup](https://www.o2switch.net/) (Support)
- [Email Deliverability Best Practices](https://www.mailgun.com/blog/email-deliverability/)

