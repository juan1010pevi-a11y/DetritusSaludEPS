/**
 * Detritus Salud E.P.S. — main.js
 * JavaScript básico: registro de botones y comportamiento de UI.
 * Cada botón tiene su ID, nombre y sección documentados.
 * ----------------------------------------------------------------
 * MAPA DE BOTONES
 * ─────────────────────────────────────────────────────────────────
 * ID                          | Sección          | Acción futura
 * ─────────────────────────────────────────────────────────────────
 * btn-login                   | Navbar           | Abrir modal login
 * btn-afiliarme               | Navbar           | Ir a /afiliacion
 * btn-logo                    | Navbar           | Ir a inicio (#)
 * nav-afiliados               | Navbar           | Ir a /afiliados
 * nav-servicios               | Navbar           | Ir a /servicios
 * nav-red                     | Navbar           | Ir a /red-atencion
 * nav-medicamentos            | Navbar           | Ir a /medicamentos
 * nav-noticias                | Navbar           | Ir a /noticias
 * nav-contacto                | Navbar           | Ir a /contacto
 * top-supersalud              | Topbar           | Enlace externo
 * top-pqrs                    | Topbar           | Ir a /pqrs
 * top-trabaja                 | Topbar           | Ir a /trabaja
 * hero-cita                   | Hero             | Abrir agendador
 * hero-autorizacion           | Hero             | Ir a /autorizaciones
 * quick-cita                  | Acceso Rápido    | Abrir agendador
 * quick-laboratorio           | Acceso Rápido    | Ir a /laboratorio
 * quick-medicamentos          | Acceso Rápido    | Ir a /medicamentos
 * quick-autorizacion          | Acceso Rápido    | Ir a /autorizaciones
 * quick-carne                 | Acceso Rápido    | Descargar carné PDF
 * quick-pqrs                  | Acceso Rápido    | Ir a /pqrs
 * search-ciudad               | Buscador IPS     | Filtrar por ciudad
 * search-especialidad         | Buscador IPS     | Filtrar por especialidad
 * search-input                | Buscador IPS     | Campo texto libre
 * search-btn                  | Buscador IPS     | Ejecutar búsqueda
 * portal-registro             | Portal Afiliado  | Ir a /registro
 * portal-login-btn            | Portal Afiliado  | Autenticar usuario
 * portal-olvide               | Portal Afiliado  | Recuperar contraseña
 * news-vacunacion             | Noticias         | Ir a noticia
 * news-salud-mental           | Noticias         | Ir a noticia
 * news-app                    | Noticias         | Ir a noticia
 * chat-fab                    | Flotante         | Abrir chat / chatbot
 * footer-facebook             | Footer           | Abrir red social
 * footer-instagram            | Footer           | Abrir red social
 * footer-twitter              | Footer           | Abrir red social
 * footer-privacidad           | Footer           | Ir a /privacidad
 * footer-terminos             | Footer           | Ir a /terminos
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

/* ─── 1. REGISTRO CENTRAL DE CLICS ──────────────────────────────
   Todos los botones llaman a esta función.
   Aquí se conectará analytics, router o API en el futuro.
────────────────────────────────────────────────────────────────── */
function btnClick(id, nombre, datos) {
  console.log(`[Detritus] 🖱 "${nombre}" (id: ${id})`, datos ?? '');
  // TODO: reemplazar console.log por llamada a analytics / router
  // Ejemplo futuro:
  // analytics.track('clic', { id, nombre, ...datos });
  // router.push(RUTAS[id]);
}


/* ─── 2. MAPA DE RUTAS (para conectar más adelante) ─────────────
────────────────────────────────────────────────────────────────── */
const RUTAS = {
  'btn-login':          '/portal/login',
  'btn-afiliarme':      '/afiliacion',
  'nav-afiliados':      '/afiliados',
  'nav-servicios':      '/servicios',
  'nav-red':            '/red-atencion',
  'nav-medicamentos':   '/medicamentos',
  'nav-noticias':       '/noticias',
  'nav-contacto':       '/contacto',
  'top-supersalud':     'https://www.supersalud.gov.co',
  'top-pqrs':           '/pqrs',
  'top-trabaja':        '/trabaja-con-nosotros',
  'hero-cita':          '/citas/nueva',
  'hero-autorizacion':  '/autorizaciones',
  'quick-cita':         '/citas/nueva',
  'quick-laboratorio':  '/laboratorio/resultados',
  'quick-medicamentos': '/medicamentos/entrega',
  'quick-autorizacion': '/autorizaciones/nueva',
  'quick-carne':        '/carne/descargar',
  'quick-pqrs':         '/pqrs/nueva',
  'portal-registro':    '/registro',
  'portal-login-btn':   '/portal/autenticar',
  'portal-olvide':      '/portal/recuperar',
  'news-vacunacion':    '/noticias/vacunacion-influenza',
  'news-salud-mental':  '/noticias/salud-mental',
  'news-app':           '/noticias/nueva-app',
  'footer-privacidad':  '/privacidad',
  'footer-terminos':    '/terminos',
};


/* ─── 3. INICIALIZACIÓN AL CARGAR EL DOM ────────────────────────
────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {

  // 3a. Sticky nav — sombra al hacer scroll
  window.addEventListener('scroll', () => {
    const nav = document.querySelector('nav');
    if (!nav) return;
    nav.style.boxShadow = window.scrollY > 10
      ? '0 4px 20px rgba(27,58,107,.18)'
      : '0 2px 10px rgba(27,58,107,.1)';
  });

  // 3b. Animación de entrada para tarjetas
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        entry.target.style.transition =
          `opacity .4s ease ${i * 80}ms, transform .4s ease ${i * 80}ms`;
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  document.querySelectorAll('.quick-card, .news-card').forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    observer.observe(card);
  });

  // 3c. Búsqueda IPS — trigger con Enter
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') buscarIPS();
    });
  }

});


/* ─── 4. FUNCIONES POR BOTÓN ────────────────────────────────────
   Una función clara por cada acción principal.
────────────────────────────────────────────────────────────────── */

// NAVBAR
function irInicio()        { btnClick('btn-logo',         'Logo / Inicio'); }
function abrirLogin()      { btnClick('btn-login',        'Iniciar sesión'); }
function irAfiliacion()    { btnClick('btn-afiliarme',    'Afiliarme'); }
function irAfiliados()     { btnClick('nav-afiliados',    'Afiliados'); }
function irServicios()     { btnClick('nav-servicios',    'Servicios'); }
function irRed()           { btnClick('nav-red',          'Red de Atención'); }
function irMedicamentos()  { btnClick('nav-medicamentos', 'Medicamentos'); }
function irNoticias()      { btnClick('nav-noticias',     'Noticias'); }
function irContacto()      { btnClick('nav-contacto',     'Contáctenos'); }

// TOPBAR
function irSupersalud()    { btnClick('top-supersalud',   'Superintendencia de Salud'); }
function irPQRS()          { btnClick('top-pqrs',         'PQRS'); }
function irTrabaja()       { btnClick('top-trabaja',      'Trabaja con nosotros'); }

// HERO
function agendarCita()     { btnClick('hero-cita',        'Agendar cita — Hero'); }
function verAutorizacion() { btnClick('hero-autorizacion','Consultar autorización — Hero'); }

// ACCESOS RÁPIDOS
function quickCita()         { btnClick('quick-cita',         'Agendar cita médica'); }
function quickLaboratorio()  { btnClick('quick-laboratorio',  'Resultados de laboratorio'); }
function quickMedicamentos() { btnClick('quick-medicamentos', 'Entrega de medicamentos'); }
function quickAutorizacion() { btnClick('quick-autorizacion', 'Solicitar autorización'); }
function quickCarne()        { btnClick('quick-carne',        'Descargar carné digital'); }
function quickPQRS()         { btnClick('quick-pqrs',         'Radicar PQRS'); }

// BUSCADOR IPS
function filtrarCiudad(val)       { btnClick('search-ciudad',       'Filtro Ciudad',       { ciudad: val }); }
function filtrarEspecialidad(val) { btnClick('search-especialidad', 'Filtro Especialidad', { especialidad: val }); }
function buscarIPS() {
  const q = document.getElementById('search-input')?.value ?? '';
  btnClick('search-btn', 'Buscar IPS', { query: q });
}

// PORTAL DEL AFILIADO
function irRegistro()  { btnClick('portal-registro',  'Crear cuenta gratis'); }
function iniciarSesion() {
  const doc  = document.getElementById('doc')?.value ?? '';
  const pass = document.getElementById('pass')?.value ? '***' : '';
  btnClick('portal-login-btn', 'Iniciar sesión — Portal', { doc, pass });
}
function olvideClave() { btnClick('portal-olvide', '¿Olvidaste tu contraseña?'); }

// NOTICIAS
function verNoticiaVacunacion()  { btnClick('news-vacunacion',    'Noticia: Vacunación Influenza'); }
function verNoticiaSaludMental() { btnClick('news-salud-mental',  'Noticia: Salud Mental'); }
function verNoticiaApp()         { btnClick('news-app',           'Noticia: Nueva App'); }

// CHAT FLOTANTE
function abrirChat() { btnClick('chat-fab', 'Asistente virtual / Chatbot'); }

// FOOTER — redes sociales
function irFacebook()  { btnClick('footer-facebook',  'Facebook'); }
function irInstagram() { btnClick('footer-instagram', 'Instagram'); }
function irTwitter()   { btnClick('footer-twitter',   'X / Twitter'); }

// FOOTER — legal
function irPrivacidad() { btnClick('footer-privacidad', 'Política de privacidad'); }
function irTerminos()   { btnClick('footer-terminos',   'Términos y condiciones'); }
