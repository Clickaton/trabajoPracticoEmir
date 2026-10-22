// Los modelos Materia y Correlatividad usan un `id` numérico que hasta ahora se tipeaba a mano.
// Si el formulario no lo envía, se asigna el siguiente libre (máximo actual + 1).
export const siguienteId = async (Modelo) => {
    const ultimo = await Modelo.findOne().sort({ id: -1 }).select('id').lean();
    return (ultimo?.id || 0) + 1;
};
