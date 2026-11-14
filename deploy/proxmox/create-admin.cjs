// Cria o primeiro utilizador (ADMIN) diretamente na base de dados. O install.sh corre
// isto porque não há registo público e a omissão é admin/admin (o login "admin" não é
// um email, e a password não tem os 8 caracteres que a criação pela app exige).
// A password vai com bcrypt, com o mesmo custo que a app usa.
//
// Só cria se ainda não houver utilizadores. Corre a partir de apps/backend, para o
// require encontrar o bcrypt e o pg do projeto:
//   DATABASE_URL=… ADMIN_EMAIL=admin ADMIN_PASSWORD=admin node create-admin.cjs
const { createRequire } = require('module');
const path = require('path');

// O require normal procura a partir da pasta deste ficheiro (deploy/proxmox), onde não
// há node_modules — as dependências vivem em apps/backend, que é a pasta de trabalho
const requireFromBackend = createRequire(path.join(process.cwd(), 'package.json'));
const bcrypt = requireFromBackend('bcrypt');
const { Client } = requireFromBackend('pg');

async function main() {
  const { DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!DATABASE_URL || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('Faltam DATABASE_URL, ADMIN_EMAIL ou ADMIN_PASSWORD.');
  }

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query('SELECT count(*)::int AS n FROM "User"');
    if (rows[0].n > 0) {
      console.log('Já há utilizadores — nada a fazer.');
      return;
    }
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await client.query(
      `INSERT INTO "User" (id, email, "firstName", "lastName", "fullName", "hashedPassword", active, role, "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, 'Administrador', '', 'Administrador', $2, true, 'ADMIN', now(), now())`,
      [ADMIN_EMAIL.trim().toLowerCase(), hash],
    );
    console.log(`Conta ${ADMIN_EMAIL} criada (ADMIN).`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
