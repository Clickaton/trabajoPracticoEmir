/* CREAMOS ESTE SCRIPT PARA PODER ENCRIPTAR TODAS LAS CONTRASEÑAS DE LOS USUARIOS QUE YA SE ENCONTRABAN REGISTRADOS.*/

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import User from '../models/User.js';

// Cargar variables de entorno
dotenv.config();

const migratePasswords = async () => {
  if (!process.env.MONGO_URI) {
    console.error('Error: La variable de entorno MONGO_URI no está definida en tu archivo .env.');
    process.exit(1);
  }

  try {
    // Conectar a la base de datos
    await mongoose.connect(process.env.MONGO_URI);
    console.log(' Conectado a MongoDB para la migración de contraseñas.');

    // Encontrar todos los usuarios
    const users = await User.find({});
    let updatedCount = 0;
    
    console.log(`🔎 Se encontraron ${users.length} usuarios. Iniciando análisis...`);
    
    // Usamos un bucle for...of para procesar secuencialmente y evitar condiciones de carrera.
    for (const user of users) {
      // Los hashes de bcrypt empiezan con '$2a$', '$2b$' o '$2y$'.
      // Si la contraseña no empieza así, asumimos que está en texto plano.
      if (user.password && !user.password.startsWith('$2')) {
        console.log(`  -> Migrando contraseña para el usuario: ${user.email} (ID: ${user.id})`);
        
        // Generamos el salt y hasheamos la contraseña actual
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(user.password, salt);
        
        // Actualizamos el documento directamente en la BD para evitar el hook 'pre-save'
        await User.updateOne({ _id: user._id }, { $set: { password: hashedPassword } });
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      console.log(`\n ¡Migración completada! Se actualizaron ${updatedCount} contraseñas.`);
    } else {
      console.log('\n No se necesitaron actualizaciones. Todas las contraseñas ya parecen estar encriptadas.');
    }

  } catch (error) {
    console.error(' Error durante el script de migración:', error);
  } finally {
    // Cerramos la conexión a la base de datos al finalizar
    await mongoose.disconnect();
    console.log(' Desconectado de MongoDB.');
  }
};

// Ejecutar el script
migratePasswords();
