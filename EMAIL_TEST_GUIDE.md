# Guide de Test et Dépannage des Emails au Spam

## Problème: Les emails vont au SPAM malgré SPF/DKIM/DMARC ✅

### Raisons principales:
1. **Headers insuffisants** → Le code a été patché avec List-ID, Auto-Submitted, X-Auto-Response-Suppress
2. **Réputation du domaine** → sirona-consult.be est nouveau/jeune
3. **Contenu détecté comme suspicious** → Les mots de passe en clair déclenchent les filtres
4. **PTR/Reverse DNS** → Potentiellement non configuré

---

## ÉTAPE 1: Vérifier que les headers fonctionnent

Les changements appliqués ajoutent ces headers critiques:

```headers
List-ID: <fenix-notifications.sirona-consult.be>
Auto-Submitted: auto-generated
X-Auto-Response-Suppress: All
List-Help: <mailto:no-reply@sirona-consult.be?subject=help>
List-Unsubscribe: <mailto:no-reply@sirona-consult.be?subject=unsubscribe>
```

Ces headers disent aux filtres: **"C'est un email système transactionnel, pas un spam"**

---

## ÉTAPE 2: Vérifier SPF/DKIM/DMARC avancé

Va sur https://mxtoolbox.com et fais ces tests:

### Test DKIM Avancé
```
1. Tape sirona-consult.be dans la barre
2. Clique sur "Blacklist" → voir si domaine est blacklisté
3. Clique sur "MX Lookup" → vérifier les enregistrements MX
4. Clique sur "Check DKIM" → doit montrer une clé valide
   - Cherche: "Public Key Found" ✅
   - Format: dkim._domainkey.sirona-consult.be
```

### Test SPF Avancé
```
1. Va sur https://mxtoolbox.com/spf.aspx
2. Tape sirona-consult.be
3. Doit montrer:
   - v=spf1 include:_custspf.one.com ~all ✅
   - "SPF record passed authentication" ✅
```

### Vérifier Reverse DNS (PTR) ⚠️ IMPORTANT
```
C'est souvent LE problème pour les emails au spam!

1. one.com doit avoir configuré le PTR record
2. Va dans les paramètres email chez one.com
3. Cherche "Reverse DNS" ou "PTR Record"
4. Doit pointer vers le serveur d'envoi (send.one.com)

Si aucun PTR record: contacter one.com support
```

---

## ÉTAPE 3: Tester avec Gmail (le plus strict)

1. Envoie un email de test
2. Regarde dans:
   - **Inbox** → c'est bon ✅
   - **Promotions** → besoin de plus d'ajustements
   - **Ham/Spam** → problème critique

3. Clique sur l'email → "Report not spam" ou "Report spam" pour donner du feedback

---

## ÉTAPE 4: Solutions complémentaires si toujours au spam

### A. Vérifier la réputation one.com
```
Si tu envoies BEAUCOUP d'emails d'un coup:
→ Rate limit: 10-20 emails/minute max pour commencer
→ Augmenter graduellement si tout passe les filtres
```

### B. Vérifier le contenu ("Spam Content")
```
Mots-clés qui declenchent les filtres:
- "PASSWORD" (mot de passe) ❌
- "URGENT" ❌
- "VERIFY ACCOUNT" ❌
- "CLICK HERE NOW" ❌
- "ACT NOW" ❌

Le code a réduit cela mais les mots de passe sont nécessaires...
```

### C. Alternative: Changer l'adresse "from"
```
Au lieu de: no-reply@sirona-consult.be
Essayer: notifications@sirona-consult.be
Ou:      admin@sirona-consult.be
Ou:      fenix@sirona-consult.be

Les filtres réagissent mieux aux emails d'une personne
plutôt qu'un compte "no-reply"
```

### D. Ajouter un unsubscribe réel (overkill mais efficace)
```
Si tu veux perdre le problème d'spam score:
1. Ajouter une vraie page de désinscription
2. Lier dans l'email: <a href="...">Unsubscribe</a>
3. Cela dit aux filtres: "C'est un email marketing sérieux"

Mais pour des emails transactionels (création compte, pwd)
ce n'est pas nécessaire avec nos headers.
```

---

## ÉTAPE 5: Vérifier les logs de rejets

Chez one.com, il y a possiblement des logs d'envoi:

```
Menu Email → Gestion des emails → no-reply@sirona-consult.be
Cherche "Activity log" ou "Send logs"
Cherche les erreurs de rejet: "550", "421", "450", etc.
```

Si tu trouves des codes d'erreur:
- **550 User unknown** → l'email n'existe pas
- **421 Too many connections** → rate limiting
- **450 Try again later** → serveur temporairement occupé
- **555 Protocol error** → malformation de l'email

---

## ÉTAPE 6: Utiliser un service de test 

### MailTester (RECOMMANDÉ)
```
1. Va sur https://www.mail-tester.com
2. Copie l'adresse email unique donnée
3. Dans ton app, simule un envoi à cette email
4. Attends quelques secondes
5. Reviens sur mail-tester → clique "Then check your score"
6. Ça donne un score 0-10 + détails sur les problèmes
```

Si score < 8 → Cela montre exactement pourquoi ça va au spam!

### Mailers.app (alternatif)
```
https://mailers.app/
Gratuit, montre les problèmes d'authentification
```

---

## Résumé: Ce qui a été fait ✅

1. ✅ Headers critiques ajoutés (`List-ID`, `Auto-Submitted`)
2. ✅ Templates HTML corrigés
3. ✅ SPF configuré chez one.com
4. ✅ DKIM activé automatiquement chez one.com
5. ✅ DMARC configuré chez one.com

---

## Prochaines étapes pour toi:

### URGENT:
1. **Vérifier Reverse DNS** chez one.com → c'est souvent LE problème
2. **Tester avec mail-tester.com** → voir le score réel

### Recommandé:
3. Essayer une autre adresse "from" (notifications@ au lieu de no-reply@)
4. Vérifier les logs d'envoi chez one.com pour les erreurs
5. Faire un test avec Gmail/Outlook personnels

### Si ça marche pas:
6. Contacter le support one.com pour:
   - Vérifier le PTR record est configuré
   - Vérifier que la reputation n'est pas compromise
   - Demander documentation DKIM avancée

---

## Outils pour déboguer:

- **mxtoolbox.com** → Vérifier SPF/DKIM/DMARC/Blacklists
- **mail-tester.com** → Tester les emails réels (MEILLEUR)
- **mailers.app** → Vérifier authentification
- **dmarc.postmarkapp.com** → Analyser les reports DMARC
