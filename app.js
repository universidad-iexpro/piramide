'use strict';
(function () {
  const A = window.ACTIVIDAD, PREGUNTAS = A.preguntas, N = PREGUNTAS.length, E = window.Escena;
  const $ = id => document.getElementById(id);
  const lienzo = $('lienzo'), video = $('video'), panel = $('panel'), marca = $('marca');
  const vibrar = p => { if (navigator.vibrate && !matchMedia('(prefers-reduced-motion: reduce)').matches) navigator.vibrate(p); };

  /* ---------- Actividad ---------- */
  let indice = 0, resueltas = 0;

  function mezclar(lista) {
    const r = lista.slice();
    for (let i = r.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [r[i], r[j]] = [r[j], r[i]];
    }
    return r;
  }

  function mostrarVista(nombre) {
    document.body.dataset.fase = nombre;
    $('vista-inicio').hidden = nombre !== 'inicio';
    $('vista-pregunta').hidden = nombre !== 'pregunta';
    $('vista-final').hidden = nombre !== 'final';
    $('chip-camara').hidden = nombre === 'inicio';
  }

  function opcionBoton(op, i) {
    const b = document.createElement('button'), letra = document.createElement('b'), texto = document.createElement('span');
    letra.textContent = 'ABCDEF'[i];
    letra.setAttribute('aria-hidden', 'true');
    texto.textContent = op.texto;
    b.append(letra, texto);
    b.onclick = () => responder(op, b);
    return b;
  }

  function mostrarPregunta() {
    const p = PREGUNTAS[indice], caja = $('opciones');
    $('contador').textContent = `PREGUNTA ${indice + 1} DE ${N}`;
    $('pregunta').textContent = p.pregunta;
    $('retro').textContent = '';
    $('continuar').hidden = true;
    caja.className = 'opciones';
    caja.replaceChildren(...mezclar(p.opciones).map(opcionBoton));
    pintarMarcas();
  }

  function pintarMarcas() {
    [...$('marcas').children].forEach((m, i) => m.classList.toggle('hecha', i < resueltas));
  }

  function responder(op, boton) {
    const letra = boton.querySelector('b');
    $('retro').textContent = op.explicacion;
    boton.disabled = true;
    if (!op.correcta) {
      boton.classList.add('mal');
      letra.textContent = '✕';
      if (E) E.error();
      vibrar(70);
      $('retro').scrollIntoView({ block: 'nearest' });
      return;
    }
    boton.classList.add('bien');
    letra.textContent = '✓';
    $('opciones').classList.add('resuelta');
    resueltas++;
    pintarMarcas();
    if (E) E.activarCara(indice);
    vibrar([20, 40, 30]);
    lienzo.setAttribute('aria-label', `Pirámide con ${resueltas} de ${N} caras completas. Arrastra o usa las flechas para girarla.`);
    const c = $('continuar');
    c.firstElementChild.textContent = resueltas === N ? 'Revelar el holograma' : 'Siguiente pregunta';
    c.hidden = false;
    c.focus();
  }

  $('continuar').onclick = () => {
    if (resueltas === N) return revelar();
    indice++;
    mostrarPregunta();
    $('pregunta').focus();
  };

  function comenzar() {
    mostrarVista('pregunta');
    mostrarPregunta();
    $('pregunta').focus();
  }
  $('comenzar').onclick = comenzar;
  $('comenzar-camara').onclick = () => { comenzar(); encenderCamara(); };

  $('repetir').onclick = () => {
    indice = resueltas = 0;
    if (E) E.reiniciar();
    comenzar();
    lienzo.setAttribute('aria-label', 'Pirámide sin completar. Arrastra o usa las flechas para girarla.');
  };

  function revelar() {
    if (E) E.revelar();
    vibrar([30, 60, 30, 60, 90]);
    mostrarVista('final');
    lienzo.setAttribute('aria-label', 'Pirámide completa con el holograma del monograma de la Universidad IEXPRO flotando sobre ella.');
    $('final-titulo').focus();
  }

  /* ---------- Cámara: se puede encender en cualquier momento ---------- */
  let flujo = null, solicitud = 0, avisoTimer = 0;
  const aviso = $('aviso-camara'), chip = $('chip-camara'), chipTexto = $('chip-texto'), botonFinal = $('camara');

  function avisar(texto, ms) {
    clearTimeout(avisoTimer);
    aviso.textContent = texto;
    aviso.hidden = !texto;
    if (texto && ms) avisoTimer = setTimeout(() => { aviso.hidden = true; }, ms);
  }

  function pintarCamara(estado) {
    const encendida = estado === 'encendida', pendiente = estado === 'pendiente';
    document.body.classList.toggle('en-vivo', encendida);
    video.hidden = !encendida;
    chip.setAttribute('aria-pressed', String(encendida));
    chip.disabled = botonFinal.disabled = pendiente;
    chipTexto.textContent = encendida ? 'Apagar cámara' : 'Cámara';
    botonFinal.firstElementChild.textContent = encendida ? 'Apagar la cámara' : 'Ver sobre mi cámara';
  }

  function apagarCamara() {
    solicitud++;
    if (flujo) flujo.getTracks().forEach(t => t.stop());
    flujo = null;
    video.srcObject = null;
    pintarCamara('apagada');
  }

  // Del pedido más exigente al más simple, porque algunas webcams rechazan las primeras opciones.
  const PEDIDOS = [
    { audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
    { audio: false, video: { facingMode: { ideal: 'environment' } } },
    { audio: false, video: true }
  ];

  async function pedirFlujo() {
    let ultimo;
    for (const pedido of PEDIDOS) {
      try {
        return await navigator.mediaDevices.getUserMedia(pedido);
      } catch (error) {
        ultimo = error;
        if (error.name === 'NotAllowedError' || error.name === 'SecurityError' || error.name === 'NotFoundError') break;
      }
    }
    throw ultimo;
  }

  function reproducir() {
    return Promise.race([
      video.play(),
      new Promise((_, no) => setTimeout(() => no(Object.assign(new Error('sin imagen'), { name: 'SinImagen' })), 7000))
    ]);
  }

  async function encenderCamara() {
    if (flujo) return;
    if (!window.isSecureContext) {
      avisar('La cámara solo funciona desde una dirección segura (https://). Esta página se abrió desde una dirección sin seguridad. Puedes seguir jugando sin cámara.');
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      avisar('Este navegador no permite usar la cámara aquí. Si abriste el enlace dentro de otra aplicación, ábrelo en Chrome o Safari. Puedes seguir jugando sin cámara.');
      return;
    }
    const turno = ++solicitud;
    pintarCamara('pendiente');
    avisar('Pulsa «Permitir» en el aviso de tu navegador.');
    let nuevo = null;
    try {
      nuevo = await pedirFlujo();
      if (turno !== solicitud) { nuevo.getTracks().forEach(t => t.stop()); return; }
      flujo = nuevo;
      video.srcObject = nuevo;
      video.hidden = false;
      // Las cámaras frontales y las webcams se ven como un espejo; la trasera del teléfono, no.
      video.classList.toggle('espejo', nuevo.getVideoTracks()[0].getSettings().facingMode !== 'environment');
      await reproducir();
      if (turno !== solicitud) return;
      pintarCamara('encendida');
      avisar('Cámara activa. La imagen no se graba ni se envía.', 3500);
      nuevo.getVideoTracks().forEach(t => t.addEventListener('ended', () => {
        if (flujo === nuevo) { apagarCamara(); avisar('La cámara se desconectó. Pulsa «Cámara» para reintentar.'); }
      }));
    } catch (error) {
      if (nuevo) nuevo.getTracks().forEach(t => t.stop());
      if (turno !== solicitud) return;
      const avisos = {
        NotAllowedError: 'El navegador o el sistema bloqueó la cámara. Actívala en los permisos del sitio y vuelve a intentarlo.',
        SecurityError: 'El navegador bloqueó la cámara en esta página. Ábrela directamente en Chrome o Safari.',
        NotFoundError: 'No se encontró ninguna cámara en este dispositivo.',
        NotReadableError: 'La cámara no se pudo abrir. Cierra otras aplicaciones que la usen, como Zoom o Teams, y vuelve a intentarlo.',
        AbortError: 'La cámara no respondió. Cierra otras aplicaciones que la usen y vuelve a intentarlo.',
        OverconstrainedError: 'Tu cámara no admite el formato solicitado.',
        SinImagen: 'La cámara se abrió pero no envió imagen. Cierra otras aplicaciones que la usen y vuelve a intentarlo.'
      };
      apagarCamara();
      avisar(`${avisos[error.name] || 'No se pudo abrir la cámara.'} Puedes seguir jugando sin ella. (Código: ${error.name})`);
    }
  }

  const alternarCamara = () => {
    if (flujo) { apagarCamara(); avisar(''); } else encenderCamara();
  };
  chip.onclick = alternarCamara;
  botonFinal.onclick = alternarCamara;
  window.addEventListener('pagehide', apagarCamara);
  // Por privacidad se apaga mientras la página está oculta o tapada, y vuelve sola al regresar.
  let reanudar = false;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (flujo) { reanudar = true; apagarCamara(); }
    } else if (reanudar) {
      reanudar = false;
      encenderCamara();
    }
  });

  /* ---------- Teclado en PC: A, B, C para responder ---------- */
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || document.body.dataset.fase !== 'pregunta') return;
    const i = 'ABCDEF'.indexOf(e.key.toUpperCase());
    const opcion = i < 0 ? null : $('opciones').children[i];
    if (opcion && !opcion.disabled && !$('opciones').classList.contains('resuelta')) opcion.click();
  });

  /* ---------- Área libre para la figura ---------- */
  if (E) {
    const lateral = matchMedia('(min-width:900px), (orientation:landscape) and (max-height:500px)');
    E.definirArea(() => {
      const w = window.innerWidth, h = window.innerHeight, m = marca.getBoundingClientRect(), p = panel.getBoundingClientRect();
      if (lateral.matches) return { x: 0, y: m.bottom * .7, w: p.left - 12, h: h - m.bottom * .7 - 12 };
      const y = m.bottom + 6;
      return { x: 0, y, w, h: Math.max(90, p.top + 18 - y) };
    });
  } else {
    lienzo.hidden = true;
    $('respaldo').hidden = false;
  }

  /* ---------- Inicio ---------- */
  $('etiqueta').textContent = A.etiqueta;
  $('titulo').textContent = A.titulo;
  $('introduccion').textContent = A.introduccion;
  $('final-titulo').textContent = A.final.titulo;
  $('final-mensaje').textContent = A.final.mensaje;
  $('marcas').replaceChildren(...PREGUNTAS.map(() => document.createElement('i')));
  mostrarVista('inicio');
})();
