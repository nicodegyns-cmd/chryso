// scripts/create_comptabilite_user.js
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function run() {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'chryso'
    });

    console.log('✅ Connecté à la base de données');

    const email = 'facturation@gmail.com';
    const password = '1234';
    const role = 'comptabilite';

    // Check if user already exists
    const [existing] = await conn.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      console.log('⚠️  Utilisateur avec cet email existe déjà');
      return;
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const [result] = await conn.query(
      `INSERT INTO users (
        email,
        password_hash,
        first_name,
        last_name,
        role,
        is_active,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        email,
        hashedPassword,
        'Admin',
        'Comptabilité',
        role,
        1 // is_active = true
      ]
    );

    console.log('✅ Utilisateur créé avec succès');
    console.log('');
    console.log('📋 Détails du compte:');
    console.log('  📧 Email:', email);
    console.log('  🔐 Mot de passe:', password);
    console.log('  👥 Rôle:', role);
    console.log('  🆔 ID utilisateur:', result.insertId);
    console.log('  ✅ Actif: Oui');
    console.log('');
    console.log('🔓 Accès immédiat disponible');

  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

run();

