// Contenido de la actividad. Este es el único archivo que hay que editar para cambiar textos o preguntas.
// La pirámide tiene una cara por pregunta: funciona con 3 a 6 preguntas.
// Cada pregunta necesita una opción con "correcta: true". El orden de las opciones se mezcla al jugar.
window.ACTIVIDAD = {
  etiqueta: 'Reto de liderazgo pedagógico',
  titulo: 'Completa la pirámide',
  introduccion: 'Responde 3 preguntas breves. Cada acierto agrega una cara a la pirámide y, al completarla, aparece el holograma.',
  final: {
    titulo: '¡Pirámide completa!',
    mensaje: 'Cada respuesta sumó una cara. Así se construye una formación de excelencia.'
  },
  preguntas: [
    {
      pregunta: '¿Qué elemento es fundamental para ejercer un liderazgo pedagógico efectivo en entornos virtuales?',
      opciones: [
        { texto: 'La supervisión constante de las actividades.', explicacion: 'Supervisar no basta por sí solo. Piensa en lo que necesita quien aprende a distancia.' },
        { texto: 'La orientación, la comunicación y el acompañamiento.', correcta: true, explicacion: 'Correcto. Orientar, comunicar y acompañar sostiene el liderazgo pedagógico a distancia.' },
        { texto: 'El uso exclusivo de plataformas digitales.', explicacion: 'Las plataformas son un medio, no el liderazgo en sí. Piensa en el papel de quien guía.' }
      ]
    },
    {
      pregunta: '¿Qué permite construir una verdadera comunidad académica virtual?',
      opciones: [
        { texto: 'El trabajo individual de cada docente.', explicacion: 'El trabajo individual aporta, pero una comunidad se forma con otras personas.' },
        { texto: 'La participación, el intercambio de experiencias y la colaboración.', correcta: true, explicacion: 'Correcto. La comunidad nace cuando sus integrantes participan, comparten y colaboran.' },
        { texto: 'La utilización de una misma plataforma.', explicacion: 'Compartir una plataforma no crea comunidad por sí solo. Piensa en cómo se relacionan sus integrantes.' }
      ]
    },
    {
      pregunta: '¿Cuál debería ser el propósito del liderazgo pedagógico en una comunidad académica?',
      opciones: [
        { texto: 'Promover el aprendizaje colectivo y la mejora continua.', correcta: true, explicacion: 'Correcto. El liderazgo pedagógico busca que la comunidad aprenda y mejore en conjunto.' },
        { texto: 'Centralizar todas las decisiones.', explicacion: 'Centralizar limita la participación. Piensa en un propósito que incluya a toda la comunidad.' },
        { texto: 'Priorizar el cumplimiento administrativo.', explicacion: 'Lo administrativo importa, pero no es el centro de lo pedagógico. Piensa en el aprendizaje.' }
      ]
    }
  ]
};
