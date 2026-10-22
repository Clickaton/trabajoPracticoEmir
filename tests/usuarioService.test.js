import test from 'node:test';
import assert from 'node:assert/strict';
import { contraseniaNueva, normalizarEmail, emailValido, emailEnUso, CAMPOS_PERFIL_ALUMNO, CAMPOS_SOLO_PERSONAL } from '../services/usuarioService.js';
import { leerCookie } from '../utils/cookies.js';

test('contraseniaNueva: vacía o en blanco significa "conservar la actual"', () => {
    assert.equal(contraseniaNueva(''), null);
    assert.equal(contraseniaNueva('   '), null);
    assert.equal(contraseniaNueva(undefined), null);
    assert.equal(contraseniaNueva(null), null);
    assert.equal(contraseniaNueva(1234), null); // no es texto
    assert.equal(contraseniaNueva('nueva clave'), 'nueva clave');
    assert.equal(contraseniaNueva('  con espacios  '), '  con espacios  '); // no se recorta: los espacios pueden ser parte de la clave
});

test('normalizarEmail y emailValido', () => {
    assert.equal(normalizarEmail('  ana@isft225.edu.ar '), 'ana@isft225.edu.ar');
    assert.equal(normalizarEmail(undefined), '');
    assert.equal(emailValido('ana@isft225.edu.ar'), true);
    for (const malo of ['', 'ana', 'ana@', '@isft.edu.ar', 'ana@isft', 'a b@c.com']) assert.equal(emailValido(malo), false, malo);
});

test('emailEnUso: busca sin distinguir mayúsculas, excluye la propia cuenta y escapa caracteres de regex', async () => {
    const consultas = [];
    const modelo = { exists: async (filtro) => { consultas.push(filtro); return filtro.id?.$ne === 7 ? null : { _id: 1 }; } };

    assert.equal(await emailEnUso('Ana@isft225.edu.ar', null, modelo), true);
    assert.equal(consultas[0].email.flags, 'i');
    assert.equal(consultas[0].email.test('ana@isft225.edu.ar'), true);
    assert.equal(consultas[0].email.test('xana@isft225.edu.ar'), false); // anclado: coincide el email completo
    assert.equal(consultas[0].id, undefined);

    // Al editar la propia cuenta (id 7) su email no cuenta como repetido
    assert.equal(await emailEnUso('ana@isft225.edu.ar', '7', modelo), false);
    assert.deepEqual(consultas[1].id, { $ne: 7 });

    // El "." y el "+" del email no se interpretan como regex
    await emailEnUso('a.b+c@x.com', null, modelo);
    assert.equal(consultas[2].email.test('aXb+c@x.com'), false);
    assert.equal(consultas[2].email.test('a.b+c@x.com'), true);

    assert.equal(await emailEnUso('', null, modelo), false);
});

test('campos del perfil: lo que edita el alumno y lo que solo carga el personal', () => {
    assert.deepEqual([...CAMPOS_PERFIL_ALUMNO], ['name', 'email', 'password']);
    for (const campo of ['dni', 'legajo', 'activo', 'fecha_inscripcion']) assert.ok(CAMPOS_SOLO_PERSONAL.includes(campo), campo);
    for (const campo of CAMPOS_PERFIL_ALUMNO) assert.ok(!CAMPOS_SOLO_PERSONAL.includes(campo), campo);
});

test('leerCookie: lee la cookie pedida del encabezado crudo', () => {
    assert.equal(leerCookie('a=1; jwtToken=abc.def.ghi; b=2', 'jwtToken'), 'abc.def.ghi');
    assert.equal(leerCookie('jwtToken="entre-comillas"', 'jwtToken'), 'entre-comillas');
    assert.equal(leerCookie('jwtToken=a%20b', 'jwtToken'), 'a b');
    assert.equal(leerCookie('jwtToken=%E0%A4%A', 'jwtToken'), '%E0%A4%A'); // codificación inválida: se devuelve tal cual
    assert.equal(leerCookie('otra=1', 'jwtToken'), null);
    assert.equal(leerCookie('xjwtToken=1', 'jwtToken'), null); // no confunde cookies con nombre parecido
    assert.equal(leerCookie(undefined, 'jwtToken'), null);
    assert.equal(leerCookie('', 'jwtToken'), null);
});
