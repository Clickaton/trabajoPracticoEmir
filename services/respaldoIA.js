// Respaldo entre varios proveedores de IA: prueba uno por uno y se queda con la primera respuesta.
//
// Si ninguno responde NO devuelve una disculpa disfrazada de respuesta: lanza un error que cuenta por qué falló cada uno.
// Así el chat sabe que hubo un fallo (no guarda la disculpa en el historial como si la hubiera dicho el modelo) y el
// registro del servidor muestra la causa real (equipo apagado, clave inválida, servicio saturado...) en una sola línea.

const LARGO_MAXIMO_DE_CAUSA = 300;

// Un `fetch` que no pudo conectar dice solo "fetch failed": el motivo (ECONNREFUSED, ETIMEDOUT...) viene en error.cause
export const describirFallo = (error) => {
    const mensaje = error?.message || String(error);
    const causa = error?.cause?.code || error?.cause?.message;
    const completo = causa && !mensaje.includes(causa) ? `${mensaje} (${causa})` : mensaje;
    return completo.length > LARGO_MAXIMO_DE_CAUSA ? `${completo.slice(0, LARGO_MAXIMO_DE_CAUSA)}…` : completo;
};

// proveedores: [{ nombre, consultar, pausaTrasFallarMs? }]. `consultar(...argumentos)` devuelve el texto o lanza un error.
// `pausaTrasFallarMs`: tras un fallo, ese proveedor pasa al final de la fila durante ese tiempo. Sirve para un equipo apagado
// que tarda segundos en rendirse: sin pausa, cada pregunta esperaría ese tiempo antes de probar con el siguiente.
// Pasa al final y no se descarta: si los demás también fallan, se lo prueba por si ya volvió.
// `ahora` es el reloj (se puede reemplazar en las pruebas).
//
// Devuelve una función que responde { texto, proveedor, fallos }: `fallos` son los que fallaron antes de que alguien respondiera.
export const crearRespaldo = (proveedores, { ahora = Date.now } = {}) => {
    const pausadoHasta = new Map();

    return async (...argumentos) => {
        const enPausa = (proveedor) => (pausadoHasta.get(proveedor.nombre) ?? 0) > ahora();
        const orden = [...proveedores.filter((p) => !enPausa(p)), ...proveedores.filter(enPausa)];
        const fallos = [];

        for (const proveedor of orden) {
            try {
                const texto = await proveedor.consultar(...argumentos);
                if (typeof texto !== 'string' || !texto.trim()) throw new Error('devolvió una respuesta vacía');
                pausadoHasta.delete(proveedor.nombre);
                return { texto, proveedor: proveedor.nombre, fallos };
            } catch (error) {
                if (proveedor.pausaTrasFallarMs) pausadoHasta.set(proveedor.nombre, ahora() + proveedor.pausaTrasFallarMs);
                fallos.push(`${proveedor.nombre}: ${describirFallo(error)}`);
            }
        }
        throw new Error(`Ningún proveedor de IA respondió. ${fallos.join(' | ')}`);
    };
};
