// Central configuration for endpoints and shared datasets
export const API_BASE_URL = (typeof window !== 'undefined' && window.API_URL) ? window.API_URL : (typeof window !== 'undefined' && window.location && window.location.origin ? window.location.origin : '');
export const MEDIA_BASE_URL = (typeof window !== 'undefined' && window.MEDIA_URL) ? window.MEDIA_URL : API_BASE_URL;

// WhatsApp configuration (front-only). Replace number when available.
export const WHATSAPP_URL = 'https://wa.me/5491112345678?text=Hola%20Patitas%20y%20Bigotes%2C%20tengo%20una%20consulta';

export const FAQ_ITEMS = [
  { id: 'adopcion-proceso', category: 'Adopciones', question: '¿Cómo es el proceso de adopción?', answer: 'Completá la solicitud, coordinamos una visita y luego firmamos el contrato cuando tu hogar esté listo.' },
  { id: 'requisitos', category: 'Adopciones', question: '¿Cuáles son los requisitos para adoptar?', answer: 'Ser mayor de edad, contar con vivienda estable, acreditar ingresos y comprometerte con los controles sanitarios.' },
  { id: 'donaciones-uso', category: 'Donaciones', question: '¿Para qué se destinan las donaciones?', answer: 'Cubrimos alimentos, tratamientos veterinarios, mantenimiento del refugio y campañas de castración.' },
  { id: 'contacto', category: 'Contacto', question: '¿Dónde estamos?', answer: 'Av. Siempreviva 1234, CABA. Atendemos de martes a sábado de 10 a 18 h.' },
  { id: 'cuenta-roles', category: 'Cuenta', question: '¿Puedo cambiar mi rol?', answer: 'El equipo operador asigna roles adicionales según el nivel de participación y responsabilidad.' },
];

export const HELP_BOT_CATEGORIES = [
  {
    id: 'adopciones',
    label: 'Adopciones',
    faqs: ['adopcion-proceso', 'requisitos'],
    fallback: '¿No encontraste tu respuesta? Podés iniciar tu solicitud desde la sección Adoptar.'
  },
  {
    id: 'donaciones',
    label: 'Donaciones',
    faqs: ['donaciones-uso'],
    fallback: 'Podés realizar una donación puntual o programar aportes desde la sección Donaciones.'
  },
  {
    id: 'contacto',
    label: 'Contacto',
    faqs: ['contacto'],
    fallback: 'Si necesitás ayuda inmediata escribinos por WhatsApp o en el formulario de contacto.'
  },
  {
    id: 'cuenta',
    label: 'Cuenta',
    faqs: ['cuenta-roles'],
    fallback: 'Los operadores asignan roles específicos según las tareas que realices en la organización.'
  }
];

export const GLOBAL_SEARCH_GROUPS = {
  mascotas: { label: 'Mascotas', icon: '??' },
  historias: { label: 'Historias', icon: '?' },
  faqs: { label: 'FAQs', icon: '?' }
};

export const ROUTE_NAMES = {
  home: '/',
  donations: '/donations',
  pets: '/pets',
  petDetail: (id) => `/pets/${id}`,
  adopt: '/adopt',
  contact: '/contact',
  signin: '/signin',
  login: '/login',
  dashboardAdopter: '/dashboard/adoptante',
  dashboardOperator: '/dashboard/operador',
  dashboardVet: '/dashboard/veterinario'
};

// Datos de cuenta para donaciones por transferencia.
// Reemplazá estos valores por los reales de la organización.
export const DONATION_ACCOUNT = {
  cvu: '0000000000000000000000', // CVU de la cuenta virtual
  alias: 'ALIAS.AQUI',          // Alias fácil de recordar
  titular: 'Patitas y Bigotes',
  documento: '',                // Ej.: CUIT 20-12345678-9 (opcional)
  proveedor: 'Mercado Pago',    // Banco/Proveedor (opcional)
  referencia: 'Donación Patitas y Bigotes',
  email: 'contacto@patitasybigotes.ar'
};
