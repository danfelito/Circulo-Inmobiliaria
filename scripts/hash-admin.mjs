import bcrypt from 'bcryptjs';

const password = process.argv[2];
if (!password || password.length < 12) {
  console.error('Uso: npm run hash-admin -- "una-contraseña-de-al-menos-12-caracteres"');
  process.exit(1);
}
console.log(await bcrypt.hash(password, 12));
