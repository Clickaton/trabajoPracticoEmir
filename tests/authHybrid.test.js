import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { requireRole, rutaInicio, ROLES_ADMINISTRATIVOS } from '../middlewares/authHybrid.js';

process.env.JWT_SECRET = 'secreto-de-prueba';

// Ejecuta un middleware con una sesión simulada y devuelve qué hizo: pasó (next), redirigió o mostró una página
const correr = (middleware, { rol, tipoPerfil, url, sinSesion = false }) => new Promise((resolve) => {
    const token = jwt.sign({ id: 1, rol, role: rol, tipoPerfil }, process.env.JWT_SECRET);
    const req = { headers: {}, cookies: sinSesion ? {} : { jwtToken: token }, originalUrl: url };
    const res = {
        status(codigo) { this.codigo = codigo; return this; },
        redirect(destino) { resolve({ tipo: 'redirect', destino }); },
        render(vista, datos) { resolve({ tipo: 'render', vista, codigo: this.codigo, datos }); }
    };
    middleware(req, res, () => resolve({ tipo: 'next' }));
});

const ROLES = [
    { rol: 'Alumno', tipoPerfil: 'Alumno' },
    { rol: 'Administrativo', tipoPerfil: 'Personal' },
    { rol: 'Direccion', tipoPerfil: 'Personal' },
    { rol: 'Secretario', tipoPerfil: 'Personal' },
    { rol: 'Profesor', tipoPerfil: 'Personal' },
    { rol: 'Bibliotecario', tipoPerfil: 'Personal' }
];

test('rutaInicio: cada rol tiene una sola pantalla de inicio, o ninguna', () => {
    assert.equal(rutaInicio({ tipoPerfil: 'Alumno', rol: 'Alumno' }), '/dashboard');
    assert.equal(rutaInicio({ rol: 'Alumno' }), '/dashboard');
    for (const rol of ROLES_ADMINISTRATIVOS) assert.equal(rutaInicio({ rol, tipoPerfil: 'Personal' }), '/api/administrativos');
    // Profesor y Bibliotecario consultan datos pero no tienen pantalla: antes se los mandaba al panel, que los rechazaba
    for (const rol of ['Profesor', 'Bibliotecario', 'Otro', '']) assert.equal(rutaInicio({ rol, tipoPerfil: 'Personal' }), null);
    assert.equal(rutaInicio({ role: 'Direccion' }), '/api/administrativos', 'también lee el campo role');
    assert.equal(rutaInicio(null), null);
    assert.equal(rutaInicio(), null);
});

test('requireRole: quien tiene el rol pedido pasa', async () => {
    for (const rol of ROLES_ADMINISTRATIVOS) {
        const r = await correr(requireRole(ROLES_ADMINISTRATIVOS), { rol, tipoPerfil: 'Personal', url: '/api/administrativos' });
        assert.equal(r.tipo, 'next', rol);
    }
});

test('requireRole: sin sesión o con una sesión inválida va al login', async () => {
    assert.deepEqual(await correr(requireRole(ROLES_ADMINISTRATIVOS), { rol: 'Alumno', url: '/api/administrativos', sinSesion: true }), { tipo: 'redirect', destino: '/login' });
});

test('requireRole: un alumno sin permiso vuelve a su dashboard', async () => {
    const r = await correr(requireRole(ROLES_ADMINISTRATIVOS), { rol: 'Alumno', tipoPerfil: 'Alumno', url: '/editUser/7' });
    assert.deepEqual(r, { tipo: 'redirect', destino: '/dashboard' });
});

test('requireRole: un administrativo sin permiso para una pantalla vuelve al panel', async () => {
    const r = await correr(requireRole(['Direccion']), { rol: 'Administrativo', tipoPerfil: 'Personal', url: '/alguna-pantalla-de-direccion' });
    assert.deepEqual(r, { tipo: 'redirect', destino: '/api/administrativos' });
});

test('requireRole: Profesor y Bibliotecario reciben una página 403 que explica, no una redirección (antes: bucle infinito)', async () => {
    for (const rol of ['Profesor', 'Bibliotecario']) {
        for (const url of ['/api/administrativos', '/api/administrativos/', '/api/administrativos?x=1', '/editUser/7', '/getUsers']) {
            const r = await correr(requireRole(ROLES_ADMINISTRATIVOS), { rol, tipoPerfil: 'Personal', url });
            assert.equal(r.tipo, 'render', `${rol} ${url}: ${JSON.stringify(r)}`);
            assert.equal(r.vista, 'error');
            assert.equal(r.codigo, 403);
            assert.equal(r.datos.statusCode, 403);
            assert.match(r.datos.message, new RegExp(`rol: ${rol}`));
        }
    }
});

test('requireRole: no hay bucles posibles (la redirección siempre va a una pantalla donde esa persona sí entra)', async () => {
    const guardasDeInicio = { '/dashboard': ['Alumno'], '/api/administrativos': ROLES_ADMINISTRATIVOS };
    const guardas = [ROLES_ADMINISTRATIVOS, ['Direccion'], ['Alumno'], ['Secretario', 'Direccion']];
    for (const persona of ROLES) {
        for (const guarda of guardas) {
            for (const url of ['/una-pantalla', '/api/administrativos', '/dashboard']) {
                const r = await correr(requireRole(guarda), { ...persona, url });
                if (r.tipo !== 'redirect') continue;
                if (r.destino === '/login') continue;
                // Salto 1: la redirección va a la pantalla de inicio de la persona...
                assert.equal(r.destino, rutaInicio(persona), `${persona.rol} ${url}`);
                // ...Salto 2: y esa pantalla la deja pasar (si no, la persona rebotaría de nuevo)
                const salto2 = await correr(requireRole(guardasDeInicio[r.destino]), { ...persona, url: r.destino });
                assert.equal(salto2.tipo, 'next', `${persona.rol} rebotaría en ${r.destino}`);
                assert.notEqual(r.destino, url, `${persona.rol} se redirige a la misma URL ${url}`);
            }
        }
    }
});

test('requireRole: quien ya está en su pantalla de inicio y no tiene permiso recibe un 403, no otra redirección', async () => {
    const r = await correr(requireRole(['Alumno']), { rol: 'Administrativo', tipoPerfil: 'Personal', url: '/api/administrativos' });
    assert.equal(r.tipo, 'render');
    assert.equal(r.codigo, 403);
});
