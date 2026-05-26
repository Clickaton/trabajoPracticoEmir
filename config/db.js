import { MongoClient } from 'mongodb';

// Configuración de conexión (Ajusta la IP/puerto)
const MONGO_URI = 'mongodb://localhost:27017'; 
const DB_NAME = 'gestion_academica';

let dbInstance = null;

export const connectDB = async () => {
    try {
        const client = new MongoClient(MONGO_URI);
        await client.connect();
        console.log('🔌 Conectado a MongoDB Exitosamente');
        dbInstance = client.db(DB_NAME);
    } catch (error) {
        console.error('❌ Error conectando a MongoDB:', error);
        process.exit(1);
    }
};

export const getDB = () => {
    if (!dbInstance) throw new Error('Debe conectarse a la base de datos primero.');
    return dbInstance;
};