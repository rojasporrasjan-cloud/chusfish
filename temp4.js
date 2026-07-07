
/* ═══ FIREBASE ═══ */
firebase.initializeApp({
  apiKey:            'AIzaSyCLFJ9xAWUw_M2UgkOUY467MmkbFe4lbIk',
  authDomain:        'chus-fish.firebaseapp.com',
  projectId:         'chus-fish',
  storageBucket:     'chus-fish.firebasestorage.app',
  messagingSenderId: '788310353696',
  appId:             '1:788310353696:web:16ca9bd3f934b915cb1945',
});
const db_cat      = firebase.firestore();
const DOC_REF_CAT = db_cat.collection('chusfish').doc('catalog');

async function loadFromFirestore() {
  try {
    const snap = await DOC_REF_CAT.get();
    if (snap.exists && snap.data().products?.length) return snap.data().products;
  } catch(e) {
    try {
      const d = localStorage.getItem('chusfish_products');
      if (d) return JSON.parse(d);
    } catch(e2) {}
  }
  return null;
}
function getStoredImage(id) { return null; } // imágenes ahora en p.img (Cloudinary)

/* ════════════════════════════════════════ */
const PRODUCTS_DEFAULT = [

  /* ═══ CAMARONES IMPORTADOS ═══ */
  { id:1, cat:'camarones-imp', name:'Camarón Pelado Cultivado Semi-Mediano', price:8500, unit:'/kg', badge:'Importado',
    desc:'Producto cultivado de tamaño semi-mediano. Viene completamente pelado, listo para cocinar directamente sin preparación previa. Ideal para arroces, pastas y salteados.' },
  { id:2, cat:'camarones-imp', name:'Camarón Cultivado Tailón Grande', price:11000, unit:'/kg', badge:'Importado',
    desc:'Camarón de cultivo con formato de cola grande ("tailón"). Presentación elegante y llamativa, perfecta para parrillas, platillos a la plancha y preparaciones gourmet.' },
  { id:3, cat:'camarones-imp', name:'Camarón Pelado Cultivado Mediano', price:9500, unit:'/kg', badge:'Importado',
    desc:'Variante de tamaño mediano, cultivado y pelado para mayor comodidad. Versátil para todo tipo de preparaciones calientes o frías.' },
  { id:4, cat:'camarones-imp', name:'Camarón Pinki Tailón Agua Salada', price:11500, unit:'/kg', badge:'Importado',
    desc:'Camarón tipo Pinki capturado en agua salada, presentado en formato de cola ("tailón"). Sabor intenso del mar, textura firme y carnosa.' },
  { id:5, cat:'camarones-imp', name:'Camarón Cultivo Agua Salada Tailón Extra-Grande', price:12000, unit:'/kg', badge:'Importado',
    desc:'Camarón de agua salada en su formato de tamaño máximo disponible ("extra-grande"). El de mayor impacto visual para presentaciones especiales y eventos.' },

  /* ═══ CAMARONES NACIONALES ═══ */
  { id:6, cat:'camarones-nac', name:'Camarón con Cabeza Yumbo', price:21600, unit:'/kg', badge:'Nacional · Sin químicos',
    desc:'Camarón entero gigante (tamaño Yumbo) que rinde exactamente 14 piezas por kilo. 100% nacional y libre de químicos. Ideal para sopas, fondos marinos y presentaciones enteras que impresionen.' },
  { id:7, cat:'camarones-nac', name:'Camarón Yumbo', price:25500, unit:'/kg', badge:'Nacional · Sin químicos',
    desc:'Formato Yumbo clásico, ideal para platillos principales, rindiendo 22 piezas por kilo. Nacional, libre de químicos y de excelente calidad. El favorito para parrillas y ceviches de lujo.' },
  { id:8, cat:'camarones-nac', name:'Camarón Cultivo Juvenil Grande', price:16000, unit:'/kg', badge:'Nacional · Sin químicos',
    desc:'Camarón nacional cosechado en etapa juvenil pero seleccionado por su buen tamaño. 100% libre de químicos, fresco y versátil para múltiples preparaciones.' },
  { id:9, cat:'camarones-nac', name:'Camarón Yumbo Juvenil', price:20800, unit:'/kg', badge:'Nacional · Sin químicos',
    desc:'Camarón yumbo en etapa más juvenil, lo que permite obtener más piezas (28 unidades) por cada kilo. Nacional y libre de químicos. Excelente rendimiento por precio.' },
  { id:10, cat:'camarones-nac', name:'Camarón Pinki pequeño para arroz', price:9600, unit:'/kg', badge:'Nacional · Sin químicos',
    desc:'Variedad nacional pequeña, idónea y muy buscada para mezclar de forma uniforme en arroces con mariscos. 100% libre de químicos. El tamaño ideal para que cada cucharada tenga camarón.' },

  /* ═══ FILETE PREMIUM ═══ */
  { id:11, cat:'filetes-premium', name:'Filete de Corvina P.P.', price:18500, unit:'/kg', badge:'Premium · Nacional',
    desc:'El premium más solicitado del catálogo. Sumamente buscado porque queda muy suave y delicioso al cocinar. Perfecto para empanizar o para preparar un ceviche de lujo. Nacional, libre de químicos, procesado higiénicamente.' },
  { id:12, cat:'filetes-premium', name:'Filete de Corvina Reina P.G.', price:13500, unit:'/kg', badge:'Premium · Nacional',
    desc:'Muy solicitado por su suavidad, con la característica de ser un poco más firme en su consistencia que la P.P. Perfecto tanto para empanizar como para armar un ceviche de primera.' },
  { id:13, cat:'filetes-premium', name:'Filete de Mero', price:15500, unit:'/kg', badge:'Premium · Nacional',
    desc:'Algo más premium y especial. Posee una textura superior y un sabor sumamente fino, ideal para lucirse en la mesa o preparar un ceviche peruano. Muy solicitado para recetas especiales de alto nivel.' },
  { id:14, cat:'filetes-premium', name:'Filete de Wahoo', price:11500, unit:'/kg', badge:'Premium · Nacional',
    desc:'Opción económica, rendidora y muy solicitada por hoteles y restaurantes. Un pescado muy versátil, de textura firme, ideal para cocinar a la plancha o empanizado con resultados espectaculares.' },
  { id:15, cat:'filetes-premium', name:'Atún Aleta Amarilla', price:9000, unit:'/kg', badge:'Premium · Nacional',
    desc:'Ofrece un sabor diferente, concentrado y con una textura especial ideal para sellar a la plancha o preparar salpicón. Muy solicitado para recetas especiales. Un clásico gourmet accesible.' },
  { id:16, cat:'filetes-premium', name:'Filete de Congrio', price:12400, unit:'/kg', badge:'Premium · Nacional',
    desc:'Opción clásica muy solicitada que destaca por su textura distinta y su sabor suave. Siendo especial para hacer empanizado, queda con una corteza perfecta y un interior jugoso.' },
  { id:17, cat:'filetes-premium', name:'Filete de Dorado', price:13500, unit:'/kg', badge:'Premium · Nacional',
    desc:'Opción clásica premium muy solicitada. Cuenta con un sabor equilibrado y textura firme. Muy versátil: se adapta perfectamente a la plancha, empanizado o para armar un ceviche de primera.' },
  { id:18, cat:'filetes-premium', name:'Filete de Trucha con Piel', price:10000, unit:'/kg', badge:'Premium · Cultivo',
    desc:'Pescado premium de cultivo con un sabor suave y agradable. Alternativa muy fácil de preparar, ideal para una comida ligera y saludable. Recomendado especialmente al horno o empanizado.' },

  /* ═══ FILETES TRADICIONALES ═══ */
  { id:19, cat:'filetes-trad', name:'Filete de Macarela con Piel', price:6000, unit:'/kg', badge:'Tradicional',
    desc:'Opción económica con un sabor diferenciado e intenso a pescado. Conserva la piel para aportarle un gusto similar al del pescado entero. Especial para hacer empanizado con ese sabor clásico que todos aman.' },
  { id:20, cat:'filetes-trad', name:'Filete de Macarela sin Piel', price:6000, unit:'/kg', badge:'Tradicional',
    desc:'Mismo sabor diferenciado e intenso a pescado que la versión con piel, pero en presentación sin piel que ofrece una textura muy suave y uniforme. Especial para empanizado.' },
  { id:21, cat:'filetes-trad', name:'Chuleta de Macarela', price:6400, unit:'/kg', badge:'Tradicional',
    desc:'Corte en rodajas o chuletas que mantiene la piel para asegurar ese gusto tradicional intenso a pescado entero. Ideal y especial para empanizado estilo casero.' },
  { id:22, cat:'filetes-trad', name:'Filete de Vela', price:5800, unit:'/kg', badge:'Tradicional',
    desc:'Filete de textura densa, muy recomendado y especial para cocinar empanizado o a la plancha. Una opción rendidora y accesible para el consumo diario.' },
  { id:23, cat:'filetes-trad', name:'Chuleta de Bolillo', price:6800, unit:'/kg', badge:'Tradicional',
    desc:'Corte transversal de Bolillo que destaca por tener una textura densa y consistente. Ideal y especial para hacer empanizado, quedando crujiente por fuera y jugoso por dentro.' },
  { id:24, cat:'filetes-trad', name:'Filete de Bolillo', price:6800, unit:'/kg', badge:'Tradicional',
    desc:'Filete limpio de Bolillo que comparte la misma textura densa de la chuleta. Recomendado especialmente para empanizado por su consistencia perfecta.' },
  { id:25, cat:'filetes-trad', name:'Filete de Espada', price:8800, unit:'/kg', badge:'Especial · Tradicional',
    desc:'Opción más especial y muy solicitada del catálogo. Posee una textura media y un sabor ligero y agradable. Excelente para ceviche, empanizar o cocinar a la plancha. Muy versátil.' },
  { id:26, cat:'filetes-trad', name:'Lomitos de Espada', price:8800, unit:'/kg', badge:'Especial · Tradicional',
    desc:'Trozos seleccionados de Espada de textura media y sabor ligero. Altamente solicitados porque son especiales para ceviche, empanizar o cocinar de forma rápida en freidora de aire con excelentes resultados.' },
  { id:27, cat:'filetes-trad', name:'Filete de Cola de Bagre', price:8800, unit:'/kg', badge:'Especial · Tradicional',
    desc:'Opción muy especial de textura media y sabor agradable. Sumamente versátil: responde excelente en ceviche, empanizado, a la plancha o preparado en salsa. Un producto que nunca decepciona.' },
  { id:28, cat:'filetes-trad', name:'Filete de Candado', price:10800, unit:'/kg', badge:'Más Vendido',
    desc:'Uno de los productos más vendidos del catálogo. Pertenece a la familia de la corvina, ofreciendo una textura suave y un sabor muy agradable. Especial para empanizar o armar un ceviche fresco del día.' },
  { id:29, cat:'filetes-trad', name:'Filete de Marlin Blanco', price:13000, unit:'/kg', badge:'Tradicional',
    desc:'Opción muy común de textura firme y sabor agradable. Ideal y especial para ceviche, empanizar o hacer a la plancha. Reconocido por su consistencia y rendimiento en cocina.' },
  { id:30, cat:'filetes-trad', name:'Filete de Marlin Rosado', price:8000, unit:'/kg', badge:'Tradicional',
    desc:'Comparte las mismas propiedades del Marlin Blanco (textura firme, sabor agradable, especial para ceviche, empanizar o plancha), pero con su coloración rosada natural que lo hace diferente y atractivo.' },
  { id:31, cat:'filetes-trad', name:'Filete de Tilapia', price:null, unit:'/kg', badge:'Más Vendido · Nacional',
    desc:'Uno de los más vendidos. Cultivado nacional de textura suave, totalmente libre de químicos, procesado sin hielo y empacado al vacío. Permite variadas recetas: ceviche, empanizado, a la plancha o al ajillo. Consultar precio disponible.' },

  /* ═══ PESCADO ENTERO ═══ */
  { id:32, cat:'pescado-entero', name:'Pescado Entero Corriente', price:5000, unit:'/kg', badge:'Artesanal · Nacional',
    desc:'Pescado entero de variedad comercial, capturado de manera artesanal. Fresco y económico, ideal para preparaciones tradicionales como frituras enteras o sudados.' },
  { id:33, cat:'pescado-entero', name:'Pescado Entero Corvina PP', price:8500, unit:'/kg', badge:'Artesanal · Nacional',
    desc:'Corvina entera pequeña/mediana (PP) de pesca artesanal nacional. Ideal para freír entera o preparar al horno con vegetales. Carne suave y deliciosa.' },
  { id:34, cat:'pescado-entero', name:'Pescado Entero Pargo', price:9000, unit:'/kg', badge:'Artesanal · Nacional',
    desc:'El clásico pargo entero nacional, muy cotizado por la calidad de su carne y su sabor inconfundible. Perfecto para frituras, al horno o a la plancha en cocina artesanal.' },

  /* ═══ PICADURA PARA CEVICHE ═══ */
  { id:35, cat:'picadura', name:'Picadura de Dorado', price:13000, unit:'/kg', badge:'Ceviche · Premium',
    desc:'Carne picada en dados de Dorado de calidad premium, lista para marinar directamente. Ideal para un ceviche de sabor equilibrado, firme y muy sabroso.' },
  { id:36, cat:'picadura', name:'Picadura de Marlin Rosado', price:8000, unit:'/kg', badge:'Ceviche · Nacional',
    desc:'Dados de Marlin Rosado limpios y listos para marinar. Aportan gran firmeza y una coloración atractiva al ceviche. Nacional y libre de químicos.' },
  { id:37, cat:'picadura', name:'Picadura de Cola de Bagre', price:8800, unit:'/kg', badge:'Ceviche · Nacional',
    desc:'Picadura limpia de Bagre, ideal para quienes gustan de un ceviche de textura media, sabor agradable y buen rendimiento. Nacional y sin químicos.' },
  { id:38, cat:'picadura', name:'Picadura de Espada', price:8800, unit:'/kg', badge:'Ceviche · Nacional',
    desc:'Dados de Espada perfectos para lograr un ceviche de sabor ligero y muy agradable al paladar. Ya cortados y limpios, listos para marinar con limón.' },
  { id:39, cat:'picadura', name:'Picadura de Vela', price:6000, unit:'/kg', badge:'Ceviche · Económico',
    desc:'Opción picada económica y rendidora para ceviches tradicionales. Textura densa que aguanta bien el marinado y da cuerpo al ceviche.' },
  { id:40, cat:'picadura', name:'Picadura de Corvina', price:13500, unit:'/kg', badge:'Ceviche · Clásico',
    desc:'La picadura clásica por excelencia, sumamente suave y la preferida para el ceviche tradicional costarricense. Nacional, libre de químicos. El sabor de referencia.' },

  /* ═══ MARISCOS VARIOS ═══ */
  { id:41, cat:'mariscos', name:'Almeja Blanca', price:5500, unit:'/kg', badge:'Mariscos',
    desc:'Almejas seleccionadas limpias con su concha. Perfectas al vapor, en salsa de vino blanco o para enriquecer sopas y arroces con un sabor auténtico al mar.' },
  { id:42, cat:'mariscos', name:'Mejillón Chileno Media Concha Grande', price:9600, unit:'/kg', badge:'Importado · Chileno',
    desc:'Mejillón importado de gran tamaño presentado en media concha. Presentación espectacular para parrillas, gratinados y mariscadas de alto impacto visual.' },
  { id:43, cat:'mariscos', name:'Mejillón Chileno Concha Entera', price:5600, unit:'/kg', badge:'Importado · Chileno',
    desc:'Presentación económica del mejillón chileno con la concha cerrada completa. Ideal para sopas, arroces y mariscadas tradicionales.' },
  { id:44, cat:'mariscos', name:'Mejillón Nueva Zelanda', price:14600, unit:'/kg', badge:'Importado · Premium',
    desc:'Mejillón premium de labios verdes de importación. Reconocido mundialmente por su tamaño excepcional y su sabor suave y dulce. La opción premium de los mejillones.' },
  { id:45, cat:'mariscos', name:'Almeja Nacional', price:6000, unit:'/kg', badge:'Nacional',
    desc:'Almeja fresca capturada en aguas locales costarricenses. Sabor auténtico del mar, perfecta para prepararlas al vapor con limón, ajo y hierbas.' },
  { id:46, cat:'mariscos', name:'Jaivas', price:6400, unit:'/kg', badge:'Nacional',
    desc:'Cangrejos enteros perfectos para enriquecer sopas, mariscadas y arroces con su sabor dulce y concentrado. De pesca artesanal nacional.' },
  { id:47, cat:'mariscos', name:'Carne de Mejillón Precocido', price:7000, unit:'/kg', badge:'Listo para cocinar',
    desc:'Solo la carne del mejillón, limpia y cocida al vapor. Sin concha y sin preparación adicional, lista para agregar directamente a sus recetas favoritas.' },
  { id:48, cat:'mariscos', name:'Aros de Calamar Empanizado', price:9800, unit:'/kg', badge:'Listo para freír',
    desc:'Calamar en aros cubierto de un empanizado crujiente, listo para freír o airfryer. Fácil, rápido y delicioso. Ideal para piqueos y reuniones.' },
  { id:49, cat:'mariscos', name:'Calamar Limpio', price:6500, unit:'/kg', badge:'Mariscos',
    desc:'Tubo de calamar blanco totalmente limpio de piel e interiores. Listo para rellenar, cortar en aros, hacer a la plancha o en salsa de su preferencia.' },
  { id:50, cat:'mariscos', name:'Calamar Tentáculo Precocido', price:7200, unit:'/kg', badge:'Listo para cocinar',
    desc:'Tentáculos de calamar precocidos, suaves y listos para usar. Perfectos para ensaladas de mariscos, arroces, mariscadas o cualquier preparación rápida.' },
  { id:51, cat:'mariscos', name:'Calamar Tubo Sucio', price:6600, unit:'/kg', badge:'Mariscos',
    desc:'Calamar entero sin limpiar, ideal para quienes prefieren procesarlo en casa y aprovechar cada parte al máximo. Económico y muy fresco.' },
  { id:52, cat:'mariscos', name:'Aros de Calamar', price:7800, unit:'/kg', badge:'Mariscos',
    desc:'Aros limpios de calamar listos para cocinar al ajillo, a la romana, en salsa o incluir en mariscadas y arroces. Tiernos y de excelente sabor.' },
  { id:53, cat:'mariscos', name:'Pulpo Grande Importado', price:11600, unit:'/kg', badge:'Importado',
    desc:'Pulpo de gran tamaño seleccionado internacionalmente por su ternura y calidad. Ideal para pulpo a la gallega, a la plancha, en ensaladas o ceviche de pulpo.' },
  { id:54, cat:'mariscos', name:'Pulpo Nacional Mediano', price:11800, unit:'/kg', badge:'Nacional',
    desc:'Pulpo local fresco de tamaño mediano. Sabor auténtico y concentrado de las costas costarricenses. Ideal para diversas preparaciones gourmet y tradicionales.' },
  { id:55, cat:'mariscos', name:'Pianguas', price:9000, unit:'/100 uds', badge:'Tradicional · Nacional',
    desc:'Molusco tradicional de manglar, extraído localmente de manera artesanal. Muy apreciado en la gastronomía costarricense. El precio es por cada 100 unidades.' },
  { id:56, cat:'mariscos', name:'Colas de Langosta', price:30000, unit:'/kg', badge:'Premium · Pedido previo', preorder:true,
    desc:'Solo las colas limpias del crustáceo más premium. Carne blanca, firme y de sabor incomparable. Ideal para parrillas, al horno con mantequilla o preparaciones gourmet especiales. Se solicita con una semana de anticipación.' },
  { id:57, cat:'mariscos', name:'Langosta Entera', price:16800, unit:'/kg', badge:'Premium · Pedido previo', preorder:true,
    desc:'Pieza entera de langosta, ideal para parrilladas gourmet y presentaciones espectaculares. El rey de los mariscos en su forma más completa. Se solicita con una semana de anticipación.' },
  { id:58, cat:'mariscos', name:'Ostras Nacionales', price:13600, unit:'/10 uds', badge:'Gourmet · Pedido previo', preorder:true,
    desc:'Ostras frescas de las costas del país, seleccionadas por su frescura y tamaño. Una experiencia gourmet sin igual. El precio es por cada 10 unidades. Se solicitan con una semana de anticipación.' },

  /* ═══ MARISCADAS Y PAELLAS ═══ */
  { id:59, cat:'mariscadas', name:"Paella Chus's Fish", price:19000, unit:'/ combo', badge:'Paella · 4-5 personas',
    desc:'Paella gigante de 2.4 kg, ideal para 4 a 5 personas. Completamente llena de sabores. Incluye: Aros de Calamar, Tentáculo, Mejillón media concha Chileno, Mejillón media concha grande, Camarón Jumbo con cabeza, Camarón Juvenil Grande, Almeja Blanca, Pescado y Carne de Mejillón.' },
  { id:60, cat:'mariscadas', name:'Mariscada Premium', price:17500, unit:'/ combo', badge:'Premium · 2-3 personas',
    desc:'Para los que quieren subir de nivel. 1.5 kg para 2 o 3 personas. Un producto diferenciado y espectacular. Incluye: Aros de Calamar, Tentáculo, Mejillón media concha grande, Cola de Langosta, Camarón Juvenil Grande, Almeja Blanca, Pescado y Jaivas.' },
  { id:61, cat:'mariscadas', name:'Mariscada Junior Posta', price:8500, unit:'/ combo', badge:'Económica · 2-3 personas',
    desc:'1 kg práctico, económico y balanceado para 2 o 3 personas. 100% consumible sin conchas, rendidor y fácil de comer. Incluye: Aros de Calamar, Tentáculo, Camarón Mediano, Pescado y Carne de Mejillón.' },
  { id:62, cat:'mariscadas', name:'Mariscada Junior Mariscos', price:8000, unit:'/ combo', badge:'Tradicional · 2-3 personas',
    desc:'Combo con concha de 1 kg para 2 o 3 personas. Opción tradicional accesible de excelente rendimiento. Incluye: Aros de Calamar, Tentáculo, Camarón mediano, Pescado, Jaivas, Mejillón Negro entero, Mejillón real largo y Almeja.' },

  /* ═══ GOURMET ═══ */
  { id:63, cat:'gourmet', name:'Porción Salmón Chileno Salar', price:12000, unit:'/kg', badge:'Gourmet · Importado',
    desc:'Porciones individuales de Salmón Chileno de la prestigiosa especie Salar (Atlántico). Calidad premium importado, con un sabor rico en grasa natural y color rosado intenso.' },
  { id:64, cat:'gourmet', name:'Porción Salmón Chileno Coho', price:13000, unit:'/kg', badge:'Gourmet · Importado',
    desc:'Filetes premium en porciones de Salmón Coho (Pacífico), reconocido internacionalmente por su excelente coloración, sabor y textura. La opción premium del salmón chileno.' },
  { id:65, cat:'gourmet', name:'Lonja Salmón Chileno Salar', price:11500, unit:'/kg', badge:'Gourmet · Importado',
    desc:'Pieza entera o lonja de Salmón especie Salar importado de Chile. Ideal para cortar las porciones al gusto del cliente o servir en presentaciones más grandes.' },
  { id:66, cat:'gourmet', name:'Tortas de Atún', price:7200, unit:'/ paquete', badge:'Gourmet · Nacional',
    desc:'Producto nacional premium elaborado a base de atún fresco de primera calidad. Cada paquete contiene 4 unidades preparadas, listas para armar hamburguesas de atún saludables y deliciosas.' },
  { id:67, cat:'gourmet', name:'Chorizo de Atún', price:7200, unit:'/ paquete', badge:'Gourmet · Nacional',
    desc:'Embutido premium artesanal de atún, una alternativa marina nacional deliciosa, ligera y saludable. El paquete incluye 5 unidades. Perfecto a la plancha o a la parrilla.' },
  { id:68, cat:'gourmet', name:'Pop-Corn de Atún', price:7800, unit:'/ paquete', badge:'Gourmet · Nacional',
    desc:'Pequeñas esferas o bocaditos crujientes de atún, sumamente rendidores y únicos. El paquete contiene 25 unidades. Perfecto para piqueos, eventos y aperitivos saludables y originales.' },
];

/* Se carga desde Firestore en initCatalog() */
let PRODUCTS = [];

/* ════════════════════════════════════════ */
const CAT_ORDER = ['camarones-imp','camarones-nac','filetes-premium','filetes-trad','pescado-entero','picadura','mariscos','mariscadas','gourmet','marinados'];

const CAT_LABELS = {
  'camarones-imp':    'Camarones <em>Importados</em>',
  'camarones-nac':    'Camarones <em>Nacionales</em>',
  'filetes-premium':  'Filete <em>Premium</em>',
  'filetes-trad':     'Filetes <em>Tradicionales</em>',
  'pescado-entero':   'Pescado <em>Entero</em>',
  'picadura':         'Picadura para <em>Ceviche</em>',
  'mariscos':         'Mariscos <em>Varios</em>',
  'mariscadas':       'Mariscadas <em>y Paellas</em>',
  'gourmet':          'Productos <em>Gourmet</em>',
  'marinados':        'Marinados <em>y Empanizadores</em>',
};

const CAT_ICONS = {
  'camarones-imp':   `<path d="M10 36 Q14 28 22 24 Q28 20 36 22 Q42 24 44 30 Q40 38 32 40 Q24 42 18 38 Q12 34 10 36Z" stroke="#c8a96e" stroke-width="1.2" fill="none"/><path d="M36 22 Q40 16 44 12" stroke="#c8a96e" stroke-width="1" fill="none" opacity="0.5"/><path d="M42 30 Q46 28 48 24" stroke="#c8a96e" stroke-width="1" fill="none" opacity="0.5"/>`,
  'camarones-nac':   `<path d="M10 36 Q14 28 22 24 Q28 20 36 22 Q42 24 44 30 Q40 38 32 40 Q24 42 18 38 Q12 34 10 36Z" stroke="#c8a96e" stroke-width="1.2" fill="none"/><path d="M36 22 Q40 16 44 12" stroke="#c8a96e" stroke-width="1" fill="none" opacity="0.5"/>`,
  'filetes-premium': `<path d="M6 26C12 14 34 8 46 22C34 26 28 36 46 36C34 46 12 40 6 26Z" stroke="#c8a96e" stroke-width="1.2" fill="none"/><circle cx="40" cy="18" r="2.5" fill="#c8a96e" opacity="0.6"/>`,
  'filetes-trad':    `<path d="M6 26C12 14 34 8 46 22C34 26 28 36 46 36C34 46 12 40 6 26Z" stroke="#c8a96e" stroke-width="1.2" fill="none"/><circle cx="40" cy="18" r="2.5" fill="#c8a96e" opacity="0.4"/>`,
  'pescado-entero':  `<path d="M6 26C12 14 34 8 46 22C34 26 28 36 46 36C34 46 12 40 6 26Z" stroke="#c8a96e" stroke-width="1.2" fill="none"/><circle cx="40" cy="18" r="3" fill="#c8a96e" opacity="0.7"/>`,
  'picadura':        `<path d="M16 10 L36 30 M20 10 L40 30 M16 30 L36 10 M20 30 L40 10" stroke="#c8a96e" stroke-width="0.8" fill="none" opacity="0.5"/><rect x="12" y="8" width="28" height="28" rx="4" stroke="#c8a96e" stroke-width="1.2" fill="none"/>`,
  'mariscos':        `<path d="M12 34 Q12 16 26 14 Q40 16 40 34 Q40 44 26 44 Q12 44 12 34Z" stroke="#c8a96e" stroke-width="1.2" fill="none"/><path d="M12 34 Q26 30 40 34" stroke="#c8a96e" stroke-width="0.8" fill="none" opacity="0.5"/>`,
  'mariscadas':      `<rect x="10" y="10" width="32" height="32" rx="4" stroke="#c8a96e" stroke-width="1.2" fill="none"/><path d="M18 26H34M26 18V34" stroke="#c8a96e" stroke-width="1" fill="none" opacity="0.7"/>`,
  'gourmet':         `<path d="M26 10L30 22L44 22L33 30L37 42L26 34L15 42L19 30L8 22L22 22Z" stroke="#c8a96e" stroke-width="1.2" fill="none" opacity="0.8"/>`,
  'marinados':       `<rect x="12" y="12" width="28" height="28" rx="4" stroke="#c8a96e" stroke-width="1.2" fill="none"/><path d="M18 20L34 20M18 26L34 26M18 32L26 32" stroke="#c8a96e" stroke-width="1" fill="none" opacity="0.7"/>`,
};

const WA_NUM  = '50660017370';
const WA_BASE = `https://wa.me/${WA_NUM}?text=`;
const ICON_WA = `<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12 0C5.373 0 0 5.373 0 12c0 2.115.549 4.1 1.508 5.83L.057 23.998l6.304-1.655A11.953 11.953 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/></svg>`;

/* ═══ FORMAT PRICE ═══ */
function fmt(price) {
  if (price === null || price === undefined) return 'Consultar';
  return '₡' + price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/* ═══ BUILD CARD ═══ */
function buildCard(p, index = 0) {
  const icon = `<svg width="36" height="36" viewBox="0 0 52 52" fill="none">${CAT_ICONS[p.cat]||''}</svg>`;
  const imgSrc = p.img || getStoredImage(p.id);
  const imgBlock = imgSrc
    ? `<img src="${imgSrc}" alt="${p.name}" loading="lazy"/>`
    : `<div class="p-img-placeholder">${icon}<span>Imagen</span></div>`;
  const priceHtml = p.price === null
    ? `<span style="font-size:0.8rem;color:var(--muted)">Consultar</span>`
    : `<small>₡</small>${p.price.toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.')} <small style="font-size:0.55rem;color:var(--muted)">${p.unit}</small>`;

  const unavailable = p.available === false || (p.stock != null && p.stock <= 0);
  const lowStock = !unavailable && p.stock != null && p.stock > 0 && p.stock <= 3;
  return `
  <div class="p-card${unavailable ? ' unavailable' : ''}" style="animation-delay: ${index * 0.05}s" data-id="${p.id}" data-cat="${p.cat}" data-name="${p.name.toLowerCase()} ${(p.desc||'').toLowerCase()}">
    <div class="p-img ${p.cat === 'marinados' || p.cat === 'gourmet' ? 'p-img-halo' : ''}">
      <span class="p-badge">${p.badge}</span>
      ${imgBlock}
      ${unavailable ? '<div class="p-unavail-tag"><span>No disponible esta semana</span></div>' : ''}
      ${lowStock ? `<div style="position:absolute;bottom:6px;left:6px;z-index:3;font-size:0.55rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;background:rgba(243,156,18,0.9);color:#060e1c;padding:0.2rem 0.5rem;border-radius:10px">¡últimas ${p.stock} ${p.unit.replace('/','').trim()}!</div>` : ''}
    </div>
    <button class="p-fav-btn${isFav(p.id) ? ' active' : ''}" data-fav="${p.id}" title="Guardar en favoritos" onclick="toggleFav('${p.id}',this);event.stopPropagation()">
      <svg viewBox="0 0 24 24" fill="${isFav(p.id) ? '#e74c3c' : 'none'}" stroke="${isFav(p.id) ? '#e74c3c' : 'currentColor'}" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
    </button>
    <div class="p-body">
      <h3 class="p-name">${p.name}</h3>
    </div>
    <div class="p-footer">
      <div class="p-price">${priceHtml}</div>
      <div style="display:flex;align-items:center;gap:0.5rem">
        <button class="p-share-btn" onclick="shareProduct('${p.id}');event.stopPropagation()" title="Compartir">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        </button>
        <button class="p-detail-btn" data-id="${p.id}"${unavailable ? ' disabled style="opacity:0.4;cursor:not-allowed"' : ''}>Ver más</button>
      </div>
    </div>
  </div>`;
}

/* ═══ BUILD GROUP ═══ */
function buildGroup(cat) {
  const items = PRODUCTS.filter(p => p.cat === cat);
  if (!items.length) return '';
  return `
  <div class="cat-group" id="group-${cat}">
    <div class="cat-group-header">
      <h2 class="cat-group-title">${CAT_LABELS[cat]}</h2>
      <div class="cat-group-line"></div>
      <span class="cat-group-count">${items.length} productos</span>
    </div>
    <div class="products-grid">${items.map((p, i) => buildCard(p, i)).join('')}</div>
  </div>`;
}

/* ═══ ACTUALIZAR CONTADORES DE PILLS ═══ */
function updateCounts() {
  const total = PRODUCTS.length;
  const allEl = document.getElementById('count-all');
  if (allEl) allEl.textContent = total;
  document.getElementById('visible-count').textContent = total;
  CAT_ORDER.forEach(cat => {
    const el = document.getElementById('count-' + cat);
    if (el) el.textContent = PRODUCTS.filter(p => p.cat === cat).length;
  });
  const sub = document.querySelector('.cat-subtitle');
  if (sub) sub.textContent = `${total} productos · Nacional e importado · Entrega a domicilio · Cadena de frío garantizada`;
}

/* ═══ RENDER CATALOG ═══ */
const wrap = document.getElementById('catalog-wrap');

async function initCatalog() {
  /* spinner mientras carga */
  wrap.insertAdjacentHTML('beforeend',
    '<p id="cat-loading" style="text-align:center;color:var(--muted);padding:5rem 1rem;font-size:0.8rem;letter-spacing:0.1em">Cargando productos⬦</p>');

  PRODUCTS = (await loadFromFirestore()) || PRODUCTS_DEFAULT;

  // Interceptar imagen de la langosta para que muestre el recorte original sobre hielo
  PRODUCTS.forEach(p => {
    if (p.name && p.name.toLowerCase().includes('langosta') && !p.name.toLowerCase().includes('cola')) {
      p.img = 'assets/langosta_editada.png';
    }
  });

  const loadEl = document.getElementById('cat-loading');
  if (loadEl) loadEl.remove();

  /* limpiar grupos previos si los hay (re-render) */
  wrap.querySelectorAll('.cat-group').forEach(g => g.remove());
  wrap.insertAdjacentHTML('afterbegin', CAT_ORDER.map(buildGroup).join(''));

  updateCounts();

  // Activar filtro desde URL param (?cat=camarones, ?cat=filetes-premium, etc.)
  const _urlCat = new URLSearchParams(window.location.search).get('cat');
  if (_urlCat) {
    activeCat = _urlCat;
    document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
    const _pill = document.querySelector(`.filter-pill[data-cat="${_urlCat}"]`);
    if (_pill) _pill.classList.add('active');
    const _mf = document.getElementById('mobile-filter');
    if (_mf) _mf.value = _urlCat;
  }

  applyFilter();
  restoreCart();
}
initCatalog();

/* ═══ FILTER & SEARCH ═══ */
let activeCat = 'all';
let searchQ   = '';

function applyFilter() {
  const catalogWrap = document.querySelector('.catalog-wrap');
  const resultsBar  = document.querySelector('.results-bar');
  if (catalogWrap) catalogWrap.style.display = '';
  if (resultsBar)  resultsBar.style.display  = '';

  const cards = document.querySelectorAll('.p-card');
  const favs = getFavs();
  let visible = 0;

  cards.forEach(card => {
    let catOk;
    if (activeCat === 'all') {
      catOk = true;
    } else if (activeCat === 'favs') {
      catOk = favs.includes(card.dataset.id);
    } else if (activeCat === 'top') {
      const pid = parseInt(card.dataset.id);
      const p = PRODUCTS.find(x => x.id === pid);
      catOk = p && p.badge && p.badge.toLowerCase().includes('más vendido');
    } else if (activeCat === 'camarones') {
      catOk = card.dataset.cat === 'camarones-imp' || card.dataset.cat === 'camarones-nac';
    } else {
      catOk = card.dataset.cat === activeCat;
    }
    const nameOk = card.dataset.name.includes(searchQ);
    const show   = catOk && nameOk;
    card.classList.toggle('hidden', !show);
    if (show) visible++;
  });

  document.getElementById('visible-count').textContent = visible;
  document.getElementById('no-results').style.display  = visible === 0 ? 'block' : 'none';

  CAT_ORDER.forEach(cat => {
    const g = document.getElementById('group-' + cat);
    if (!g) return;
    const hasVisible = g.querySelectorAll('.p-card:not(.hidden)').length > 0;
    g.style.display = hasVisible ? '' : 'none';
  });
}

document.querySelectorAll('.filter-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeCat = btn.dataset.cat;
    
    const mf = document.getElementById('mobile-filter');
    if (mf) mf.value = activeCat;
    
    applyFilter();
  });
});

const mobileFilterEl = document.getElementById('mobile-filter');
if (mobileFilterEl) {
  mobileFilterEl.addEventListener('change', (e) => {
    activeCat = e.target.value;
    
    document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
    const matchingBtn = document.querySelector(`.filter-pill[data-cat="${activeCat}"]`);
    if(matchingBtn) matchingBtn.classList.add('active');
    
    applyFilter();
  });
}

document.getElementById('search-input').addEventListener('input', e => {
  searchQ = e.target.value.toLowerCase().trim();
  applyFilter();
});

/* ════════════════════════════════════════ */
function isKg(unit)    { return (unit || '').toLowerCase().includes('kg'); }
function getStep(unit) { return isKg(unit) ? 0.5 : 1; }
function getMin(unit)  { return isKg(unit) ? 0.5 : 1; }
function getMax(unit)  { return isKg(unit) ? 10  : 20; }
function fmtQty(qty, unit) {
  if (isKg(unit)) return qty + ' kg';
  const u = (unit || '').replace(/\//g, '').trim().toLowerCase();
  if (u.includes('paquete')) return qty + ' ' + (qty === 1 ? 'paquete' : 'paquetes');
  if (u.includes('combo'))   return qty + ' ' + (qty === 1 ? 'combo'   : 'combos');
  if (u.includes('unidad'))  return qty + ' ' + (qty === 1 ? 'unidad'  : 'unidades');
  return qty + (u ? ' ' + u : '');
}

/* ════════════════════════════════════════ */
let modalQty = 0.5;
let currentProduct = null;

const overlay     = document.getElementById('modal-overlay');
const modalName   = document.getElementById('modal-name');
const modalBadge  = document.getElementById('modal-badge');
const modalDesc   = document.getElementById('modal-desc');
const modalPrice  = document.getElementById('modal-price');
const modalPre    = document.getElementById('modal-preorder');
const modalIcon   = document.getElementById('modal-icon-svg');
const qtyVal      = document.getElementById('qty-val');
const btnWaDirect = document.getElementById('btn-wa-direct');

function updateModalState() {
  const p = currentProduct;
  if (!p) return;
  /* cantidad */
  qtyVal.textContent = fmtQty(modalQty, p.unit);
  /* precio dinámico */
  if (p.price === null) {
    modalPrice.innerHTML = '<span style="font-size:1.2rem;color:var(--muted)">Consultar precio</span>';
  } else {
    const total = p.price * modalQty;
    modalPrice.innerHTML = `
      ${fmt(total)}<small style="font-size:0.52rem;opacity:0.65;margin-left:3px">${isKg(p.unit) ? 'total' : p.unit}</small>
      <div style="font-size:0.68rem;color:var(--muted);margin-top:5px;font-family:'Montserrat',sans-serif;font-weight:300;letter-spacing:0.04em">
        ${fmt(p.price)}${p.unit} &nbsp;·&nbsp; ${fmtQty(modalQty, p.unit)}
      </div>`;
  }
}

function openModal(id) {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;
  currentProduct = p;
  modalQty = getMin(p.unit);
  if (window.fbq) fbq('track','ViewContent',{ content_name: p.name, content_ids:[p.id], content_type:'product', value: p.price||0, currency:'CRC' });

  modalName.textContent  = p.name;
  modalBadge.textContent = p.badge;
  modalDesc.textContent  = p.desc;

  /* Imagen en el área del modal */
  const modalImgArea = document.getElementById('modal-icon-area');
  const imgSrc = p.img || getStoredImage(p.id);
  const prevImg = modalImgArea.querySelector('img');
  if (prevImg) prevImg.remove();
  if (imgSrc) {
    const img = document.createElement('img');
    img.src = imgSrc; img.alt = p.name;
    modalImgArea.appendChild(img);
    modalIcon.style.display = 'none';
  } else {
    modalIcon.style.display = '';
    modalIcon.innerHTML = CAT_ICONS[p.cat] || '';
  }

  modalPre.style.display = p.preorder ? 'flex' : 'none';
  updateModalState();

  const addBtn = document.getElementById('btn-add-cart');
  const notifyBox = document.getElementById('notify-box');
  if (p.available === false) {
    addBtn.disabled = true;
    addBtn.textContent = 'No disponible esta semana';
    addBtn.style.opacity = '0.4';
    addBtn.style.cursor = 'not-allowed';
    if (notifyBox) {
      notifyBox.classList.add('show');
      notifyBox.innerHTML = `<p class="notify-lbl">🔔 ¿Querés que te avisemos cuando esté disponible?</p>
        <div class="notify-row">
          <input type="tel" id="notify-phone" class="notify-tel" placeholder="Número WhatsApp (ej. 8888-8888)">
          <button class="notify-go" onclick="submitNotify()">Avisame</button>
        </div>`;
    }
  } else {
    addBtn.disabled = false;
    addBtn.textContent = 'Agregar al carrito';
    addBtn.style.opacity = '';
    addBtn.style.cursor = '';
    if (notifyBox) notifyBox.classList.remove('show');
  }

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  overlay.classList.remove('open');
  document.body.style.overflow = '';
  currentProduct = null;
}

document.getElementById('modal-close').addEventListener('click', closeModal);
overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); closeCart(); } });

document.getElementById('qty-minus').addEventListener('click', () => {
  if (!currentProduct) return;
  const step = getStep(currentProduct.unit);
  const min  = getMin(currentProduct.unit);
  if (modalQty > min) {
    modalQty = Math.round((modalQty - step) * 10) / 10;
    updateModalState();
  }
});
document.getElementById('qty-plus').addEventListener('click', () => {
  if (!currentProduct) return;
  const step = getStep(currentProduct.unit);
  const max  = getMax(currentProduct.unit);
  if (modalQty < max) {
    modalQty = Math.round((modalQty + step) * 10) / 10;
    updateModalState();
  }
});

document.getElementById('btn-add-cart').addEventListener('click', () => {
  if (!currentProduct) return;
  addToCart(currentProduct, modalQty);
  closeModal();
  showToast(`${fmtQty(modalQty, currentProduct.unit)} de ${currentProduct.name} al carrito ✅`);
});

// "Pedir por WhatsApp": agrega el producto y abre el formulario para que el pedido
// quede registrado en Firestore (y aparezca en el panel de Pedidos), no solo en el chat.
btnWaDirect.addEventListener('click', () => {
  if (!currentProduct) return;
  addToCart(currentProduct, modalQty);
  closeModal();
  openCartOrderForm();
});

/* click en card */
document.addEventListener('click', e => {
  const btn = e.target.closest('.p-detail-btn');
  const card = e.target.closest('.p-card');
  if (btn) {
    e.stopPropagation();
    openModal(parseInt(btn.dataset.id));
  } else if (card && !btn) {
    openModal(parseInt(card.dataset.id));
  }
});

/* ════════════════════════════════════════ */
function getFavs() { try { return JSON.parse(localStorage.getItem('chusfish_favs') || '[]'); } catch(e) { return []; } }
function saveFavs(favs) { try { localStorage.setItem('chusfish_favs', JSON.stringify(favs)); } catch(e) {} }
function isFav(id) { return getFavs().includes(id); }
function toggleFav(id, btn) {
  let favs = getFavs();
  if (favs.includes(id)) {
    favs = favs.filter(f => f !== id);
    btn.classList.remove('active');
    btn.querySelector('svg').setAttribute('fill','none');
    btn.querySelector('svg').setAttribute('stroke','currentColor');
    if (activeCat === 'favs') { const card = document.querySelector(`.p-card[data-id="${id}"]`); if (card) card.classList.add('hidden'); applyFilter(); }
  } else {
    favs.push(id);
    btn.classList.add('active');
    btn.querySelector('svg').setAttribute('fill','#e74c3c');
    btn.querySelector('svg').setAttribute('stroke','#e74c3c');
  }
  saveFavs(favs);
}

function shareProduct(id) {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;
  const priceText = p.price ? `₡${p.price.toLocaleString()} ${p.unit}` : 'precio a consultar';
  const msg = `🐟✨ *${p.name}* 💰 ${priceText}\n${p.desc ? p.desc.slice(0,80) + '...' : ''}\n\n🐟 Pedilo en Chus's Fish: ${location.href.split('?')[0]}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
}

/* ════════════════════════════════════════ */
let cart = [];

function saveCart() {
  try { localStorage.setItem('chusfish_cart', JSON.stringify(cart.map(i => ({ id: i.product.id, qty: i.qty })))); } catch(e) {}
}

function restoreCart() {
  try {
    const saved = localStorage.getItem('chusfish_cart');
    if (!saved) return;
    const entries = JSON.parse(saved);
    entries.forEach(({ id, qty }) => {
      const p = PRODUCTS.find(x => x.id === id);
      if (p && p.available !== false) cart.push({ product: p, qty });
    });
    if (cart.length > 0) renderCartUI();
  } catch(e) {}
}

function addToCart(product, qty) {
  const existing = cart.find(i => i.product.id === product.id);
  if (existing) {
    const max = getMax(product.unit);
    existing.qty = Math.min(Math.round((existing.qty + qty) * 10) / 10, max);
  } else {
    cart.push({ product, qty });
  }
  saveCart();
  renderCartUI();
  if (window.fbq) fbq('track','AddToCart',{ content_name: product.name, content_ids:[product.id], content_type:'product', value: (product.price||0)*qty, currency:'CRC' });
}

function updateCartQty(id, direction) {
  const item = cart.find(i => i.product.id === id);
  if (!item) return;
  const step = getStep(item.product.unit);
  const min  = getMin(item.product.unit);
  const max  = getMax(item.product.unit);
  item.qty = Math.round((item.qty + direction * step) * 10) / 10;
  item.qty = Math.max(min, Math.min(item.qty, max));
  saveCart();
  renderCartUI();
}

function removeFromCart(id) {
  cart = cart.filter(i => i.product.id !== id);
  saveCart();
  renderCartUI();
}

let currentDeliveryFee = 0;

function updateDeliveryFee(price) {
  currentDeliveryFee = price || 0;
  const el = document.getElementById('cart-delivery-fee');
  if (!el) return;
  if (currentDeliveryFee > 0) {
    el.style.display = '';
    el.textContent = `+ Envío zona: ₡${currentDeliveryFee.toLocaleString()}`;
  } else {
    el.style.display = 'none';
  }
}

function renderCartUI() {
  const badge      = document.getElementById('cart-badge');
  const cartEmpty  = document.getElementById('cart-empty');
  const cartItems  = document.getElementById('cart-items');
  const cartFooter = document.getElementById('cart-footer');
  const totalEl    = document.getElementById('cart-total-val');
  const waBtn      = document.getElementById('cart-wa-btn');

  const subtotal = cart.reduce((sum, i) => sum + (i.product.price || 0) * i.qty, 0);
  const total = subtotal + currentDeliveryFee;

  badge.textContent   = cart.length; // nº de productos distintos en el carrito
  badge.style.display = cart.length > 0 ? 'flex' : 'none';

  if (cart.length === 0) {
    cartEmpty.style.display  = 'flex';
    cartItems.style.display  = 'none';
    cartFooter.style.display = 'none';
    return;
  }

  cartEmpty.style.display  = 'none';
  cartItems.style.display  = 'block';
  cartFooter.style.display = 'block';

  cartItems.innerHTML = cart.map(item => {
    const p        = item.product;
    const subtotal = p.price ? fmt(p.price * item.qty) : null;
    const showSub  = subtotal && item.qty !== getMin(p.unit);
    const thumb    = p.img
      ? `<div class="cart-item-thumb"><img src="${p.img}" alt="${p.name}" loading="lazy"></div>`
      : `<div class="cart-item-thumb"><svg viewBox="0 0 52 52" fill="none">${CAT_ICONS[p.cat]||''}</svg></div>`;
    return `
    <div class="cart-item">
      ${thumb}
      <div class="cart-item-info">
        <div class="cart-item-name" title="${p.name}">${p.name}</div>
        <div class="cart-item-price">
          ${p.price ? fmt(p.price) + p.unit : 'Consultar'}
          ${p.preorder ? '<span style="color:var(--gold-lt);font-size:0.6rem"> · Previo</span>' : ''}
        </div>
        ${showSub ? `<div style="font-size:0.64rem;color:var(--gold-lt);margin-top:2px">Total: ${subtotal}</div>` : ''}
      </div>
      <div class="cart-item-controls">
        <button class="cart-qty-btn" data-action="dec" data-id="${p.id}">−</button>
        <span class="cart-qty-val">${fmtQty(item.qty, p.unit)}</span>
        <button class="cart-qty-btn" data-action="inc" data-id="${p.id}">+</button>
        <button class="cart-remove" data-action="remove" data-id="${p.id}" title="Eliminar">·</button>
      </div>
    </div>`;
  }).join('');

  totalEl.textContent = total > 0 ? fmt(total) + '*' : 'Consultar';

  const hasPreorder = cart.some(i => i.product.preorder);

  let msg = "Hola Chus's Fish! 🛒🐟 Quiero hacer el siguiente pedido:\n\n";
  cart.forEach(i => {
    msg += `⬢ ${fmtQty(i.qty, i.product.unit)} de ${i.product.name}`;
    if (i.product.price) msg += ` ₡ ${fmt(i.product.price * i.qty)} (${fmt(i.product.price)}${i.product.unit})`;
    else msg += ' 💬 Consultar precio';
    if (i.product.preorder) msg += ' 📅 (pedido previo)';
    msg += '\n';
  });
  if (hasPreorder) msg += '\n📅 Algunos productos requieren pedido con 1 semana de anticipación.\n';
  if (total > 0) msg += `\n💰 Monto de referencia: ₡${fmt(total)} (el peso final puede variar)\n`;
  msg += '\nPor favor confirmar disponibilidad y coordinar entrega. ¡Muchas gracias!';

  window._cartWaMsg = msg;
}

document.getElementById('cart-wa-btn').addEventListener('click', function() {
  closeCart();
  openCartOrderForm();
  if (window.fbq) {
    const total = cart.reduce((s,i) => s + (i.product.price||0)*i.qty, 0);
    fbq('track','InitiateCheckout',{ num_items: cart.length, value: total, currency:'CRC' });
  }
});

document.getElementById('cart-items').addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const id     = parseInt(btn.dataset.id);
  const action = btn.dataset.action;
  if (action === 'inc')    updateCartQty(id, +1);
  if (action === 'dec')    updateCartQty(id, -1);
  if (action === 'remove') removeFromCart(id);
});

function openCart() {
  document.getElementById('cart-panel').classList.add('open');
  document.getElementById('cart-backdrop').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  document.getElementById('cart-panel').classList.remove('open');
  document.getElementById('cart-backdrop').classList.remove('open');
  document.body.style.overflow = '';
}

document.getElementById('cart-float').addEventListener('click', openCart);
document.getElementById('cart-close').addEventListener('click', closeCart);
document.getElementById('cart-backdrop').addEventListener('click', closeCart);

/* ═══ TOAST ═══ */
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

/* ═══ CANVAS ═══ */
(function() {
  const canvas = document.getElementById('bg-canvas');
  const ctx = canvas.getContext('2d');
  let W, H, bubbles;
  function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
  function mkB() {
    const r = 1.5 + Math.random() * 9;
    return {
      x: Math.random() * W,
      y: H + Math.random() * 400, r,
      speed:       0.15 + Math.random() * 0.55,
      drift:       (Math.random() - 0.5) * 0.2,
      wobble:      Math.random() * Math.PI * 2,
      wobbleSpeed: 0.015 + Math.random() * 0.03,
      alpha:       0.12 + Math.random() * 0.3,
    };
  }
  function init() { resize(); bubbles = Array.from({length: 75}, mkB); }
  function tick() {
    ctx.clearRect(0, 0, W, H);
    bubbles.forEach(b => {
      b.y      -= b.speed;
      b.wobble += b.wobbleSpeed;
      b.x      += Math.sin(b.wobble) * 0.35 + b.drift;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle   = `rgba(160,210,255,${b.alpha * 0.18})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(180,225,255,${b.alpha})`;
      ctx.lineWidth   = 0.7;
      ctx.stroke();
      /* highlight */
      if (b.r > 3) {
        ctx.beginPath();
        ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.28, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${b.alpha * 0.5})`;
        ctx.fill();
      }
      if (b.y < -20) Object.assign(b, mkB(), {y: H + 20, x: Math.random() * W});
    });
    requestAnimationFrame(tick);
  }
  window.addEventListener('resize', resize, {passive: true});
  init(); tick();
})();

/* ═══ HAMBURGER ═══ */
const catDrawer  = document.getElementById('cat-drawer');
const catOverlay = document.getElementById('cat-overlay');
function openCatDrawer()  { catDrawer.classList.add('open'); catOverlay.classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeCatDrawer() { catDrawer.classList.remove('open'); catOverlay.classList.remove('open'); document.body.style.overflow = ''; }
document.getElementById('hamburger').addEventListener('click', openCatDrawer);
document.getElementById('cat-drawer-close').addEventListener('click', closeCatDrawer);
catOverlay.addEventListener('click', closeCatDrawer);
// Cerrar drawer antes de navegar (fix blank page en iOS Safari/PWA)
catDrawer.querySelectorAll('.cat-drawer-link').forEach(link => {
  link.addEventListener('click', function(e) {
    const href = this.getAttribute('href');
    if (href && !href.startsWith('#')) {
      e.preventDefault();
      closeCatDrawer();
      setTimeout(() => { window.location.href = href; }, 320);
    } else {
      closeCatDrawer();
    }
  });
});

/* ═══ Service Worker ═══ */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
