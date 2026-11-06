import mongoose from 'mongoose';

// Conexión a MongoDB Atlas. Lanza el error si no se puede conectar: quien arranca el sistema decide qué hacer.
export const conectarBaseDeDatos = async (uri = process.env.MONGO_URI) => {
    await mongoose.connect(uri);
    console.log('Conectado exitosamente a MongoDB Atlas');
};
