'use strict';
// Escena 3D de la actividad: pirámide de cristal, plataforma, haz de luz y holograma.
// Expone window.Escena con las acciones que usa app.js. Si el equipo no tiene WebGL, queda en null.
window.Escena = (function () {
  const T = window.TRES, TEX = window.TEXTURAS, N = window.ACTIVIDAD.preguntas.length;
  const lienzo = document.getElementById('lienzo');
  const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let render;
  try {
    render = new T.WebGLRenderer({ canvas: lienzo, alpha: true, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    return null;
  }
  render.setClearColor(0x000000, 0);

  const limitar = (v, a, b) => Math.min(b, Math.max(a, v));
  const suave = p => p * p * (3 - 2 * p);
  const rebote = p => { const c = 1.4, q = p - 1; return 1 + (c + 1) * q * q * q + c * q * q; };
  const hex = h => { const n = parseInt(h.slice(1), 16); return new T.Vector3((n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255); };

  const escena = new T.Scene();
  const FOV = 32, CAM_Y = 1.35, CAM_Z = 8.4;
  const camara = new T.PerspectiveCamera(FOV, 1, .1, 60);
  camara.position.set(0, CAM_Y, CAM_Z);
  camara.lookAt(0, 0, 0);
  const DIST = Math.hypot(CAM_Y, CAM_Z);

  const raiz = new T.Group(); escena.add(raiz);
  const conjunto = new T.Group(); raiz.add(conjunto);   // pirámide y plataforma
  const giratorio = new T.Group(); conjunto.add(giratorio); // lo que gira con el dedo

  const tiempo = { value: 0 };

  function shader(opciones) {
    return new T.ShaderMaterial(Object.assign({ transparent: true, depthWrite: false }, opciones));
  }
  const aditivo = { blending: T.AdditiveBlending };

  /* ---------- Textura de destello ---------- */
  function texturaDestello() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.18, 'rgba(255,220,240,.75)'); g.addColorStop(.45, 'rgba(255,110,190,.2)'); g.addColorStop(1, 'rgba(255,61,159,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    x.globalCompositeOperation = 'lighter';
    [[128, 3], [3, 128]].forEach(([w, h]) => {
      const r = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      r.addColorStop(0, 'rgba(255,255,255,.9)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = r; x.fillRect(64 - w / 2, 64 - h / 2, w, h);
    });
    return new T.CanvasTexture(c);
  }
  const destelloTex = texturaDestello();
  function destello(escala) {
    const s = new T.Sprite(new T.SpriteMaterial({ map: destelloTex, blending: T.AdditiveBlending, depthWrite: false, transparent: true }));
    s.scale.setScalar(escala);
    return s;
  }

  /* ---------- Pirámide: una cara por pregunta ---------- */
  const R = 1, H = 1.62;
  const base = Array.from({ length: N }, (_, i) => { const a = i * Math.PI * 2 / N; return new T.Vector3(R * Math.sin(a), 0, R * Math.cos(a)); });
  const cima = new T.Vector3(0, H, 0);

  const VERT_CARA = `
    attribute vec3 bari; varying vec3 vB; varying vec3 vN; varying vec3 vV;
    void main(){ vB=bari; vN=normalMatrix*normal; vec4 m=modelViewMatrix*vec4(position,1.); vV=-m.xyz; gl_Position=projectionMatrix*m; }`;
  const FRAG_CARA = `
    uniform float uT,uActiva,uFlash,uError; uniform vec3 uA,uB;
    varying vec3 vB; varying vec3 vN; varying vec3 vV;
    void main(){
      float borde=min(min(vB.x,vB.y),vB.z);
      vec3 g=fract(vB*7.); vec3 d=min(g,1.-g);
      float malla=1.-smoothstep(.0,.045,min(min(d.x,d.y),d.z));
      float fres=pow(1.-abs(dot(normalize(vN),normalize(vV))),2.);
      float barrido=exp(-pow((vB.x-fract(uT*.2))*8.,2.));
      float filo=1.-smoothstep(.0,.035,borde);
      if(uActiva<.5){
        vec3 c=mix(vec3(.6,.68,1.),vec3(1.,.35,.5),uError);
        gl_FragColor=vec4(c*(.9+uError),(.035+malla*(.2+barrido*.4)+filo*.2)*(1.+uError*1.6));
        return;
      }
      vec3 c=mix(uA,uB,pow(vB.x,1.15));
      c=c*(.72+fres*.8)+uB*malla*(.5+barrido*1.8)+vec3(1.)*barrido*.2+vec3(1.,.9,.97)*filo*.9+vec3(1.)*uFlash*.85;
      gl_FragColor=vec4(c,.74+fres*.2+malla*.16+uFlash*.2);
    }`;
  const PALETA = [['#27308F', '#6E8BFF'], ['#5A1FB8', '#C86BFF'], ['#B3136E', '#FF7CC4'], ['#3A2BC4', '#8FA2FF'], ['#8A1FB0', '#E77CFF'], ['#C4186F', '#FFA0D4']];

  function geometriaCara(a, b, c) {
    const centro = a.clone().add(b).add(c).multiplyScalar(1 / 3);
    const pa = a.clone().sub(centro), pb = b.clone().sub(centro), pc = c.clone().sub(centro);
    const n = pb.clone().sub(pa).cross(pc.clone().sub(pa)).normalize();
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Float32Array([...pa.toArray(), ...pb.toArray(), ...pc.toArray()]), 3));
    g.setAttribute('normal', new T.BufferAttribute(new Float32Array([...n.toArray(), ...n.toArray(), ...n.toArray()]), 3));
    g.setAttribute('bari', new T.BufferAttribute(new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]), 3));
    return { g, centro };
  }

  const caras = base.map((v, i) => {
    const sig = base[(i + 1) % N], angulo = (i + .5) * Math.PI * 2 / N;
    const { g, centro } = geometriaCara(cima, v, sig);
    const pal = PALETA[i % PALETA.length];
    const uni = { uT: tiempo, uActiva: { value: 0 }, uFlash: { value: 0 }, uError: { value: 0 }, uA: { value: hex(pal[0]) }, uB: { value: hex(pal[1]) } };
    const guia = new T.Mesh(g, shader(Object.assign({ uniforms: Object.assign({}, uni, { uActiva: { value: 0 } }), vertexShader: VERT_CARA, fragmentShader: FRAG_CARA, side: T.DoubleSide }, aditivo)));
    guia.position.copy(centro);
    const solida = new T.Mesh(g, shader({ uniforms: Object.assign({}, uni, { uActiva: { value: 1 } }), vertexShader: VERT_CARA, fragmentShader: FRAG_CARA, side: T.DoubleSide }));
    solida.visible = false;
    giratorio.add(guia, solida);
    return { guia, solida, centro, angulo, salida: new T.Vector3(Math.sin(angulo), .42, Math.cos(angulo)).normalize(), inicio: null, llego: false };
  });

  /* ---------- Aristas de luz ---------- */
  const uniBrillo = { value: .5 };
  const VERT_ARISTA = `varying vec3 vN; varying vec3 vV; void main(){ vN=normalMatrix*normal; vec4 m=modelViewMatrix*vec4(position,1.); vV=-m.xyz; gl_Position=projectionMatrix*m; }`;
  const matNucleo = shader(Object.assign({ uniforms: { uBrillo: uniBrillo }, vertexShader: VERT_ARISTA, fragmentShader: `uniform float uBrillo; void main(){ gl_FragColor=vec4(vec3(1.,.86,.95)*uBrillo,min(1.,uBrillo)); }` }, aditivo));
  const matHalo = shader(Object.assign({ uniforms: { uBrillo: uniBrillo }, vertexShader: VERT_ARISTA, fragmentShader: `uniform float uBrillo; varying vec3 vN; varying vec3 vV; void main(){ float f=pow(abs(dot(normalize(vN),normalize(vV))),2.5); gl_FragColor=vec4(vec3(1.,.28,.64),f*.5*uBrillo); }` }, aditivo));
  function arista(p, q) {
    const largo = p.distanceTo(q), medio = p.clone().add(q).multiplyScalar(.5);
    const orient = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), q.clone().sub(p).normalize());
    [[.011, matNucleo], [.05, matHalo]].forEach(([r, m]) => {
      const c = new T.Mesh(new T.CylinderGeometry(r, r, largo, 8, 1, true), m);
      c.position.copy(medio); c.quaternion.copy(orient); c.renderOrder = 30;
      giratorio.add(c);
    });
  }
  base.forEach((v, i) => { arista(v, base[(i + 1) % N]); arista(v, cima); });
  const destellos = [...base, cima].map((p, i) => {
    const s = destello(i === N ? .55 : .3); s.position.copy(p); s.renderOrder = 31; giratorio.add(s); return s;
  });

  /* ---------- Núcleo de energía: crece con cada acierto ---------- */
  const uniNucleo = { value: 0 };
  const nucleo = new T.Mesh(new T.IcosahedronGeometry(.17, 0), shader(Object.assign({
    uniforms: { uE: uniNucleo }, vertexShader: VERT_ARISTA,
    fragmentShader: `uniform float uE; varying vec3 vN; varying vec3 vV; void main(){ float f=pow(1.-abs(dot(normalize(vN),normalize(vV))),1.5); gl_FragColor=vec4(mix(vec3(1.,.3,.7),vec3(1.),f),(.3+f)*uE); }`
  }, aditivo)));
  nucleo.position.y = .52; nucleo.renderOrder = 10;
  giratorio.add(nucleo);
  const auraNucleo = destello(1); auraNucleo.position.y = .52; auraNucleo.renderOrder = 10; giratorio.add(auraNucleo);

  /* ---------- Plataforma ---------- */
  const uniEnergia = { value: .3 };
  const plataforma = new T.Mesh(new T.PlaneGeometry(4.2, 4.2), shader(Object.assign({
    uniforms: { uT: tiempo, uE: uniEnergia },
    vertexShader: `varying vec2 vP; void main(){ vP=position.xy/2.1; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `
      uniform float uT,uE; varying vec2 vP;
      float anillo(float r,float x,float w){ return 1.-smoothstep(0.,w,abs(r-x)); }
      void main(){
        float r=length(vP), a=atan(vP.y,vP.x), tau=6.28318;
        if(r>1.){ discard; }
        vec3 mag=vec3(1.,.24,.62), lil=vec3(.56,.64,1.);
        float fondoR=pow(1.-r,1.4);
        float l1=anillo(r,.94,.007), l2=anillo(r,.76,.005), l3=anillo(r,.5,.005);
        float rayas=anillo(r,.86,.018)*step(.5,fract(a*12./tau-uT*.09));
        float marcas=anillo(r,.98,.012)*step(.84,fract(a*60./tau));
        float rayas2=anillo(r,.63,.012)*step(.62,fract(a*7./tau+uT*.14));
        float giroB=fract((a+uT*.9)/tau);
        float barre=pow(giroB,7.)*(1.-smoothstep(.955,1.,giroB))*smoothstep(.94,.12,r)*.6;
        vec3 c=mag*fondoR*.5+lil*(l1*1.1+l3*.7+marcas*.9)+mag*(l2*.9+rayas*1.2+rayas2*.9)+mix(lil,mag,.5)*barre*.8;
        float k=.55+uE*.7;
        gl_FragColor=vec4(c*k,clamp(fondoR*.55+l1+l2+l3+rayas+marcas+rayas2+barre*.7,0.,1.)*smoothstep(1.,.97,r));
      }`,
    side: T.DoubleSide
  }, aditivo)));
  plataforma.rotation.x = -Math.PI / 2; plataforma.position.y = -.01; plataforma.renderOrder = 1;
  conjunto.add(plataforma);

  // Arcos que giran, como el trazo del logo.
  const matArco = c => shader(Object.assign({ uniforms: { uC: { value: hex(c) }, uE: uniEnergia }, vertexShader: `varying vec2 vU; void main(){ vU=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`, fragmentShader: `uniform vec3 uC; uniform float uE; varying vec2 vU; void main(){ float p=sin(vU.x*3.14159); gl_FragColor=vec4(uC*(1.+uE),p*p); }` }, aditivo));
  const arcos = [[1.78, 2.6, '#FF3D9F'], [1.62, 1.9, '#A9B6FF']].map(([rad, largo, c]) => {
    const m = new T.Mesh(new T.TorusGeometry(rad, .018, 8, 96, largo), matArco(c));
    m.rotation.x = Math.PI / 2; m.position.y = .03; m.renderOrder = 2; conjunto.add(m);
    return m;
  });

  /* ---------- Partículas ---------- */
  const CANT = 260, sem = new Float32Array(CANT * 4);
  for (let i = 0; i < CANT * 4; i++) sem[i] = Math.random();
  const geoAmb = new T.BufferGeometry();
  geoAmb.setAttribute('position', new T.BufferAttribute(new Float32Array(CANT * 3), 3));
  geoAmb.setAttribute('sem', new T.BufferAttribute(sem, 4));
  const ambiente = new T.Points(geoAmb, shader(Object.assign({
    uniforms: { uT: tiempo, uE: uniEnergia, uPx: { value: 1 } },
    vertexShader: `
      attribute vec4 sem; uniform float uT,uE,uPx; varying float vA; varying float vC;
      void main(){
        float y=mod(sem.y*7.+uT*(.1+sem.w*.22)*(1.+uE),7.)-3.;
        float ang=sem.x*6.283+uT*.07*(sem.w-.5), rad=.9+sem.z*3.4;
        vec3 p=vec3(cos(ang)*rad,y,sin(ang)*rad);
        vA=smoothstep(-3.,-2.,y)*(1.-smoothstep(2.6,4.,y))*(.35+sem.w*.65)*(.55+.45*sin(uT*2.+sem.x*40.));
        vC=sem.z;
        vec4 m=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*m;
        gl_PointSize=(5.+sem.w*11.)*uPx/-m.z*7.;
      }`,
    fragmentShader: `varying float vA; varying float vC; void main(){ float d=length(gl_PointCoord-.5)*2.; float f=pow(max(0.,1.-d),2.); gl_FragColor=vec4(mix(vec3(1.,.42,.75),vec3(.68,.74,1.),step(.45,vC)),f*vA); }`
  }, aditivo)));
  ambiente.frustumCulled = false; ambiente.renderOrder = 40; raiz.add(ambiente);

  // Estallido reutilizable al acertar y al revelar.
  const CANT_E = 180, dirE = new Float32Array(CANT_E * 4);
  for (let i = 0; i < CANT_E; i++) {
    const z = Math.random() * 2 - 1, a = Math.random() * 6.283, r = Math.sqrt(1 - z * z);
    dirE.set([r * Math.cos(a), z, r * Math.sin(a), Math.random()], i * 4);
  }
  const geoE = new T.BufferGeometry();
  geoE.setAttribute('position', new T.BufferAttribute(new Float32Array(CANT_E * 3), 3));
  geoE.setAttribute('dir', new T.BufferAttribute(dirE, 4));
  const uniE = { uS: { value: 99 }, uFuerza: { value: 1 }, uPx: uniAmbPx(), uO: { value: new T.Vector3() } };
  function uniAmbPx() { return ambiente.material.uniforms.uPx; }
  const estallidoP = new T.Points(geoE, shader(Object.assign({
    uniforms: uniE,
    vertexShader: `
      attribute vec4 dir; uniform float uS,uFuerza,uPx; uniform vec3 uO; varying float vA; varying float vC;
      void main(){
        float v=(.6+dir.w*1.6)*uFuerza;
        vec3 p=uO+dir.xyz*v*(1.-exp(-uS*2.6))+vec3(0.,-.32*uS*uS,0.);
        vA=max(0.,1.-uS/(.8+dir.w*.9)); vC=dir.w;
        vec4 m=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*m;
        gl_PointSize=(7.+dir.w*13.)*uPx/-m.z*7.;
      }`,
    fragmentShader: `varying float vA; varying float vC; void main(){ float d=length(gl_PointCoord-.5)*2.; float f=pow(max(0.,1.-d),1.7); gl_FragColor=vec4(mix(vec3(1.,.3,.7),mix(vec3(1.),vec3(.65,.72,1.),step(.7,vC)),step(.38,vC)),f*vA); }`
  }, aditivo)));
  estallidoP.frustumCulled = false; estallidoP.renderOrder = 41; estallidoP.visible = false; raiz.add(estallidoP);

  // Onda expansiva sobre la plataforma.
  const uniOnda = { uP: { value: 1 } };
  const onda = new T.Mesh(new T.PlaneGeometry(9, 9), shader(Object.assign({
    uniforms: uniOnda,
    vertexShader: `varying vec2 vP; void main(){ vP=position.xy/4.5; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float uP; varying vec2 vP; void main(){ float r=length(vP); float x=abs(r-uP*.95); float a=(1.-smoothstep(0.,.05+uP*.05,x))*(1.-uP); gl_FragColor=vec4(mix(vec3(1.),vec3(1.,.25,.65),uP),a); }`,
    side: T.DoubleSide
  }, aditivo)));
  onda.rotation.x = -Math.PI / 2; onda.position.y = .02; onda.visible = false; onda.renderOrder = 3;
  conjunto.add(onda);

  /* ---------- Holograma ---------- */
  const holo = new T.Group(); holo.visible = false; raiz.add(holo);
  const uniEntrada = { value: 0 };
  const cargar = src => { const im = new Image(); const t = new T.Texture(im); im.onload = () => { t.needsUpdate = true; }; im.src = src; t.minFilter = T.LinearFilter; return t; };
  const texMono = cargar(TEX.monograma), texHalo = cargar(TEX.halo);
  const ALTO_H = 1.36, ANCHO_H = ALTO_H * TEX.proporcion;

  const CAPAS = 22, PROF = .3;
  const geoCapa = new T.PlaneGeometry(ANCHO_H, ALTO_H);
  const capaIdx = new Float32Array(CAPAS);
  for (let i = 0; i < CAPAS; i++) capaIdx[i] = i / (CAPAS - 1);
  geoCapa.setAttribute('capa', new T.InstancedBufferAttribute(capaIdx, 1));
  const monograma = new T.InstancedMesh(geoCapa, shader(Object.assign({
    uniforms: { uT: tiempo, uTex: { value: texMono }, uEntrada: uniEntrada },
    vertexShader: `
      attribute float capa; varying vec2 vU; varying float vC; varying float vY;
      void main(){ vU=uv; vC=capa; vY=position.y; gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.); }`,
    fragmentShader: `
      uniform sampler2D uTex; uniform float uT,uEntrada; varying vec2 vU; varying float vC; varying float vY;
      float az(float x){ return fract(sin(x*91.17)*43758.5); }
      void main(){
        if(vU.y>uEntrada*1.12) discard;
        float banda=floor(vY*26.), paso=floor(uT*11.);
        float rafaga=step(.78,az(floor(uT*1.6)));
        float gl=rafaga*step(.9,az(banda+paso))*(az(banda*3.+paso)-.5)*.07;
        vec2 u=vU+vec2(gl,0.);
        vec4 m=texture2D(uTex,u);
        float rr=texture2D(uTex,u+vec2(.005,0.)).a, bb=texture2D(uTex,u-vec2(.005,0.)).a;
        float frente=1.-smoothstep(.0,1.,abs(vC-.5)*2.);
        float cuerpo=vC>.97?.9:(.012+frente*.022);
        float lineas=.74+.26*sin(vY*150.-uT*7.);
        float barre=exp(-pow(vU.y-fract(uT*.3)*1.3+.15,2.)*90.);
        float parpadeo=.93+.07*sin(uT*31.)*sin(uT*7.3);
        vec3 c=m.rgb*1.15;
        c=mix(c,c*vec3(.42,.58,1.),step(m.r,m.b));
        c=mix(c,vec3(1.),smoothstep(.55,1.,m.a)*(vC>.97?.12:0.));
        c.r+=rr*.14; c.b+=bb*.18;
        c=c*lineas*parpadeo*cuerpo+vec3(1.,.85,.95)*barre*m.a*.8;
        float filo=exp(-pow((vU.y-uEntrada*1.12)*30.,2.))*step(uEntrada,.999);
        c+=vec3(1.,.6,.85)*filo*2.*m.a;
        gl_FragColor=vec4(c/max(cuerpo,.001),clamp(m.a*cuerpo,0.,1.));
      }`,
    side: T.DoubleSide
  }, aditivo)), CAPAS);
  const mat4 = new T.Matrix4();
  for (let i = 0; i < CAPAS; i++) monograma.setMatrixAt(i, mat4.makeTranslation(0, 0, (i / (CAPAS - 1) - .5) * PROF));
  monograma.frustumCulled = false; monograma.renderOrder = 22;
  holo.add(monograma);

  const uniHalo = { value: 0 };
  const halo = new T.Mesh(new T.PlaneGeometry(ANCHO_H * TEX.haloEscala[0] * 1.08, ALTO_H * TEX.haloEscala[1] * 1.08), shader(Object.assign({
    uniforms: { uTex: { value: texHalo }, uE: uniHalo },
    vertexShader: `varying vec2 vU; void main(){ vU=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform sampler2D uTex; uniform float uE; varying vec2 vU; void main(){ vec4 m=texture2D(uTex,vU); gl_FragColor=vec4(m.rgb*1.2,m.a*uE); }`,
    side: T.DoubleSide
  }, aditivo)));
  halo.position.z = -.2; halo.renderOrder = 21;
  holo.add(halo);

  // Lema de la universidad girando alrededor del monograma.
  const lemaCanvas = document.createElement('canvas'); lemaCanvas.width = 3072; lemaCanvas.height = 72;
  const texLema = new T.CanvasTexture(lemaCanvas); texLema.wrapS = T.RepeatWrapping; texLema.minFilter = T.LinearFilter;
  function dibujarLema() {
    const x = lemaCanvas.getContext('2d'), frase = 'UNIVERSIDAD IEXPRO   ✦   FORMACIÓN DE EXCELENCIA   ✦   ';
    x.clearRect(0, 0, 3072, 72);
    x.font = '700 46px Cinzel, Georgia, serif'; x.textBaseline = 'middle';
    const ancho = x.measureText(frase).width, veces = Math.max(1, Math.round(3072 / ancho));
    x.save(); x.scale(3072 / (ancho * veces), 1);
    x.fillStyle = '#fff';
    for (let i = 0; i < veces; i++) x.fillText(frase, i * ancho, 38);
    x.restore();
    texLema.needsUpdate = true;
  }
  dibujarLema();
  if (document.fonts && document.fonts.load) document.fonts.load('700 46px Cinzel').then(dibujarLema, () => {});
  const uniLema = { value: 0 };
  const lema = new T.Mesh(new T.CylinderGeometry(1.95, 1.95, .28, 96, 1, true), shader(Object.assign({
    uniforms: { uTex: { value: texLema }, uE: uniLema },
    vertexShader: `varying vec2 vU; void main(){ vU=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform sampler2D uTex; uniform float uE; varying vec2 vU; void main(){ float a=texture2D(uTex,vU).a; float k=gl_FrontFacing?1.:.16; float linea=(1.-smoothstep(0.,.03,abs(vU.y-.04)))+(1.-smoothstep(0.,.03,abs(vU.y-.96))); vec3 c=mix(vec3(1.,.55,.82),vec3(1.),a); gl_FragColor=vec4(c*1.15,(a+linea*.5)*k*uE); }`,
    side: T.DoubleSide
  }, aditivo)));
  lema.position.y = -.62; lema.rotation.x = .1; lema.renderOrder = 23;
  holo.add(lema);

  // Anillos orbitales con satélites de luz.
  const orbitas = [[2.08, .3, .35, '#FF3D9F'], [1.72, -.24, 1.9, '#A9B6FF']].map(([rad, inc, fase, c]) => {
    const g = new T.Group(); g.rotation.set(Math.PI / 2 + inc, 0, 0);
    const anillo = new T.Mesh(new T.TorusGeometry(rad, .009, 6, 128), shader(Object.assign({ uniforms: { uC: { value: hex(c) }, uE: uniLema }, vertexShader: `void main(){ gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`, fragmentShader: `uniform vec3 uC; uniform float uE; void main(){ gl_FragColor=vec4(uC*1.3,.75*uE); }` }, aditivo)));
    const sat = destello(.34); sat.position.x = rad; anillo.renderOrder = 24; sat.renderOrder = 25;
    const brazo = new T.Group(); brazo.add(sat); g.add(anillo, brazo);
    holo.add(g);
    return { g, brazo, sat, fase };
  });

  // Cono de luz entre la cima de la pirámide y el holograma.
  const ALTO_HAZ = 1;
  const geoHaz = new T.CylinderGeometry(1, .03, ALTO_HAZ, 64, 1, true); geoHaz.translate(0, ALTO_HAZ / 2, 0);
  const uniHaz = { value: 0 };
  const haz = new T.Mesh(geoHaz, shader(Object.assign({
    uniforms: { uT: tiempo, uE: uniHaz },
    vertexShader: `varying vec2 vU; varying vec3 vN; varying vec3 vV; void main(){ vU=uv; vN=normalMatrix*normal; vec4 m=modelViewMatrix*vec4(position,1.); vV=-m.xyz; gl_Position=projectionMatrix*m; }`,
    fragmentShader: `
      uniform float uT,uE; varying vec2 vU; varying vec3 vN; varying vec3 vV;
      void main(){
        float f=abs(dot(normalize(vN),normalize(vV)));
        float rayos=.55+.45*pow(.5+.5*sin(vU.x*6.283*17.+uT*1.3),3.)+.25*sin(vU.x*6.283*5.-uT*.8);
        float subida=.8+.2*sin(vU.y*24.-uT*5.);
        vec3 c=mix(vec3(1.,.25,.68),vec3(.6,.68,1.),vU.y);
        float a=pow(1.-vU.y,1.25)*pow(f,1.4)*rayos*subida*.8*uE;
        gl_FragColor=vec4(c*1.2,a);
      }`,
    side: T.DoubleSide
  }, aditivo)));
  haz.renderOrder = 20; haz.visible = false; raiz.add(haz);
  const fuente = destello(1.1); fuente.renderOrder = 26; fuente.visible = false; raiz.add(fuente);

  /* ---------- Estado ---------- */
  const ext = { w: 4.4, h: 3.5 };
  let ancho = 1, alto = 1, pr = 1, giro = .5, objetivo = null, arrastre = null, desplazo = 0, giroHolo = 0;
  let revelado = null, previo = 0, sacudida = 0, centroX = 0, centroY = 0, escalaActual = 0, resueltas = 0, nucleoObjetivo = 0, nucleoActual = 0;
  let estallidoInicio = null, ondaInicio = null, ondaFinal = false, areaVisible = () => ({ x: 0, y: 0, w: ancho, h: alto });

  function ajustar() {
    ancho = window.innerWidth; alto = window.innerHeight;
    render.setPixelRatio(pr = Math.min(window.devicePixelRatio || 1, limitePr));
    render.setSize(ancho, alto, false);
    camara.aspect = ancho / alto;
    ambiente.material.uniforms.uPx.value = pr * Math.min(1.25, alto / 800 + .25);
  }
  let limitePr = 2;
  window.addEventListener('resize', ajustar);
  ajustar();

  function estallar(origen, fuerza, ahora) {
    uniE.uO.value.copy(origen);
    uniE.uFuerza.value = fuerza;
    estallidoInicio = ahora;
    estallidoP.visible = true;
  }

  function cuadro(t) {
    const dt = Math.min(50, t - previo || 16); previo = t;
    tiempo.value = t * .001;
    medirRendimiento(dt);
    const ms = revelado === null ? 0 : t - revelado;

    const rev = revelado === null ? 0 : (reducido ? 1 : suave(limitar((ms - 650) / 1300, 0, 1)));
    const entrada = revelado === null ? 0 : (reducido ? 1 : limitar((ms - 1250) / 1400, 0, 1));
    const cargaFinal = revelado === null ? 0 : (reducido ? 0 : suave(limitar(ms / 650, 0, 1)) * (1 - rev));

    if (!arrastre) {
      if (objetivo !== null) {
        giro += (objetivo - giro) * Math.min(1, dt * .0055);
        if (Math.abs(objetivo - giro) < .004) objetivo = null;
      } else if (!reducido) {
        giro += dt * .00034 * (1 + cargaFinal * 22 + (revelado !== null && rev < 1 ? (1 - rev) * 6 : 0));
      }
    }
    giratorio.rotation.y = giro;

    caras.forEach(c => {
      const orden = 10 + Math.cos(c.angulo + giro) * 5;
      c.guia.renderOrder = orden - .1;
      c.solida.renderOrder = orden;
      if (c.inicio === null) return;
      const p = reducido ? 1 : limitar((t - c.inicio) / 780, 0, 1), e = rebote(p);
      c.solida.visible = true;
      c.solida.position.copy(c.centro).addScaledVector(c.salida, (1 - suave(p)) * 2.7);
      c.solida.scale.setScalar(.25 + .75 * limitar(e, 0, 1.15));
      if (p >= 1 && !c.llego) {
        c.llego = true;
        c.solida.material.uniforms.uFlash.value = reducido ? 0 : 1;
        if (!reducido) {
          const m = c.centro.clone().applyAxisAngle(new T.Vector3(0, 1, 0), giro);
          estallar(m.add(conjunto.position), .95, t);
          ondaInicio = t; ondaFinal = false;
        }
      }
      const f = c.solida.material.uniforms.uFlash;
      if (f.value > 0) f.value = Math.max(0, f.value - dt * .002);
    });

    // Error: la figura vibra y se enciende.
    if (sacudida > 0) {
      sacudida = Math.max(0, sacudida - dt * .0026);
      caras.forEach(c => { c.guia.material.uniforms.uError.value = sacudida; });
    }
    conjunto.position.x = sacudida > 0 ? Math.sin(t * .07) * .05 * sacudida : 0;

    // Energía según aciertos.
    const nivel = resueltas / N;
    nucleoObjetivo = revelado !== null ? 1.5 : nivel;
    nucleoActual += (nucleoObjetivo - nucleoActual) * Math.min(1, dt * .004);
    uniNucleo.value = nucleoActual;
    uniBrillo.value = .55 + nucleoActual * .85 + (reducido ? 0 : Math.sin(t * .003) * .1) + cargaFinal * 1.4;
    uniEnergia.value = .3 + nivel * .7 + cargaFinal;
    nucleo.rotation.set(t * .0007, t * .0011, 0);
    nucleo.scale.setScalar(.45 + nucleoActual * .85 + cargaFinal * .7);
    auraNucleo.scale.setScalar(nucleoActual > .01 ? .6 + nucleoActual * 1.2 + cargaFinal * 2.4 : .001);
    auraNucleo.material.opacity = limitar(nucleoActual * 1.1, 0, 1);
    destellos.forEach((s, i) => { s.material.opacity = limitar(.4 + nucleoActual * .6, 0, 1) * (reducido ? 1 : .8 + .2 * Math.sin(t * .004 + i * 2)); });
    arcos[0].rotation.z = reducido ? 0 : t * .00055; arcos[1].rotation.z = reducido ? 1.4 : -t * .0008;

    // Pirámide baja y se reduce para dejar sitio al holograma.
    const yPir = -.8 - rev * .95, ePir = 1 - rev * .32;
    conjunto.position.y = yPir;
    conjunto.scale.setScalar(ePir);

    // Encuadre en el área libre de la pantalla.
    const a = areaVisible();
    const cxObj = a.x + a.w / 2, cyObj = a.y + a.h / 2;
    centroX += (cxObj - centroX) * (centroX ? Math.min(1, dt * .007) : 1);
    centroY += (cyObj - centroY) * (centroY ? Math.min(1, dt * .007) : 1);
    camara.setViewOffset(ancho, alto, ancho / 2 - centroX, alto / 2 - centroY, ancho, alto);
    const ppu = alto / (2 * DIST * Math.tan(FOV * Math.PI / 360));
    const extW = ext.w, extH = ext.h + rev * .85;
    const esc = Math.min(a.w / (extW * ppu), a.h / (extH * ppu), 1.5);
    escalaActual += (esc - escalaActual) * (escalaActual ? Math.min(1, dt * .007) : 1);
    raiz.scale.setScalar(escalaActual);

    // Estallido y onda.
    if (estallidoInicio !== null) {
      const s = (t - estallidoInicio) * .001;
      uniE.uS.value = s;
      if (s > 2) { estallidoP.visible = false; estallidoInicio = null; }
    }
    if (ondaInicio !== null) {
      const p = (t - ondaInicio) / (ondaFinal ? 1300 : 800);
      onda.visible = p < 1;
      uniOnda.uP.value = limitar(p, 0, 1) * (ondaFinal ? 1 : .55) + (ondaFinal ? 0 : .0);
      if (p >= 1) ondaInicio = null;
    }

    // Holograma.
    if (revelado !== null) {
      const cimaY = yPir + H * ePir;
      if (!reducido && !ondaFinal && ms >= 650 && ms < 900) {
        ondaFinal = true; ondaInicio = t;
        estallar(new T.Vector3(0, cimaY, 0), 2.1, t);
        window.dispatchEvent(new Event('escena-destello'));
      }
      holo.visible = entrada > 0 || rev > .5;
      uniEntrada.value = entrada;
      uniHalo.value = suave(entrada) * .85;
      uniLema.value = suave(limitar((ms - 2000) / 900, 0, 1));
      if (reducido) uniLema.value = 1;
      const vaiven = reducido ? 0 : Math.sin(t * .00062) * .5;
      giroHolo += (limitar(vaiven + desplazo, -1.05, 1.05) - giroHolo) * Math.min(1, dt * .006);
      if (!arrastre) desplazo *= .988;
      const yH = 1 + (reducido ? 0 : Math.sin(t * .0014) * .035);
      holo.position.y = yH;
      monograma.rotation.y = halo.rotation.y = giroHolo;
      lema.rotation.y = reducido ? 0 : -t * .00028;
      orbitas.forEach((o, i) => {
        o.brazo.rotation.z = (reducido ? 0 : t * (i ? -.0009 : .0012)) + o.fase;
        o.g.rotation.y = reducido ? 0 : Math.sin(t * .0004 + i * 2) * .14;
        o.sat.material.opacity = uniLema.value;
      });
      haz.visible = rev > .02;
      uniHaz.value = suave(limitar((ms - 900) / 900, 0, 1));
      if (reducido) uniHaz.value = 1;
      const altoHaz = Math.max(.01, yH - ALTO_H * .32 - cimaY);
      haz.position.y = cimaY;
      haz.scale.set(ANCHO_H * .48, altoHaz, ANCHO_H * .48);
      fuente.visible = rev > .02;
      fuente.position.y = cimaY;
      fuente.material.opacity = uniHaz.value;
      fuente.scale.setScalar(.8 + (reducido ? 0 : Math.sin(t * .005) * .08));
    }

    render.render(escena, camara);
    requestAnimationFrame(cuadro);
  }

  /* Baja la resolución si el teléfono no alcanza una fluidez aceptable. */
  let muestras = 0, suma = 0;
  function medirRendimiento(dt) {
    if (limitePr <= 1 || document.hidden) return;
    suma += dt; muestras++;
    if (muestras < 90) return;
    if (suma / muestras > 30) { limitePr = limitePr > 1.5 ? 1.5 : 1; ajustar(); }
    muestras = 0; suma = 0;
  }

  /* ---------- Giro con dedo, ratón y teclado ---------- */
  lienzo.addEventListener('pointerdown', e => {
    arrastre = { x: e.clientX, id: e.pointerId };
    objetivo = null;
    lienzo.setPointerCapture(e.pointerId);
  });
  lienzo.addEventListener('pointermove', e => {
    if (!arrastre || arrastre.id !== e.pointerId) return;
    const dx = e.clientX - arrastre.x;
    giro += dx * .011;
    desplazo = limitar(desplazo + dx * .006, -.9, .9);
    arrastre.x = e.clientX;
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(n => lienzo.addEventListener(n, () => { arrastre = null; }));
  lienzo.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    objetivo = null;
    const paso = e.key === 'ArrowLeft' ? -.22 : .22;
    giro += paso;
    desplazo = limitar(desplazo + paso, -.9, .9);
  });

  requestAnimationFrame(cuadro);

  return {
    definirArea(fn) { areaVisible = fn; },
    activarCara(i) {
      const c = caras[i];
      c.inicio = performance.now();
      c.llego = false;
      resueltas = caras.filter(x => x.inicio !== null).length;
      const vuelta = Math.PI * 2, destino = -c.angulo;
      objetivo = giro + ((((destino - giro) % vuelta) + vuelta + Math.PI) % vuelta - Math.PI);
    },
    error() { sacudida = 1; },
    revelar() { revelado = performance.now(); objetivo = null; },
    reiniciar() {
      caras.forEach(c => { c.inicio = null; c.llego = false; c.solida.visible = false; });
      resueltas = 0; revelado = null; desplazo = 0; ondaFinal = false; ondaInicio = null;
      holo.visible = haz.visible = fuente.visible = onda.visible = false;
      uniEntrada.value = uniHalo.value = uniLema.value = uniHaz.value = 0;
    }
  };
})();
