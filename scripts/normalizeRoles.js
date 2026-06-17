import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import { inferRoleFromDoc } from '../utils/roleUtil.js';

dotenv.config();

const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  console.error('FATAL: Falta la variable de entorno MONGO_URI en .env');
  process.exit(1);
}
async function main() {
  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Conectado a MongoDB para normalizar roles');

  const users = await User.find().lean();
  console.log(`Se encontraron ${users.length} usuarios`);

  let updated = 0;
  for (const u of users) {
    const normalized = inferRoleFromDoc(u) || 'alumno';
    if (String(u.role || '').toLowerCase() !== String(normalized).toLowerCase()) {
      await User.updateOne({ _id: u._id }, { $set: { role: normalized } });
      console.log(`Actualizado ${u.email || u.name} -> role: ${normalized}`);
      updated++;
    }
  }

  console.log(`Normalización completada. Documentos actualizados: ${updated}`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('Error normalizando roles:', err);
  process.exit(1);
});
