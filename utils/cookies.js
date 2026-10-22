// Lee una cookie del encabezado "Cookie" tal como llega (lo usa el chat, que no pasa por cookie-parser).
// Devuelve el valor o null si la cookie no está.
export const leerCookie = (encabezado, nombre) => {
    if (typeof encabezado !== 'string' || !nombre) return null;

    for (const par of encabezado.split(';')) {
        const igual = par.indexOf('=');
        if (igual < 0 || par.slice(0, igual).trim() !== nombre) continue;

        const valor = par.slice(igual + 1).trim().replace(/^"(.*)"$/, '$1');
        try {
            return decodeURIComponent(valor);
        } catch {
            return valor; // codificación inválida: se devuelve tal cual
        }
    }
    return null;
};
