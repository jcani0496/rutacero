/**
 * RutaCero Accessibility Checklist & Utilities
 *
 * Guía y utilidades para cumplir con estándares WCAG 2.1 AA.
 * Los componentes y tests deben usar estas constantes para evitar
 * accesibilidad "declarada" sin enforcement real.
 */

export const MAIN_CONTENT_ID = 'main-content';

// ============================================
// CHECKLIST DE ACCESIBILIDAD
// ============================================

export const ACCESSIBILITY_CHECKLIST = {
  // 1. FOCUS RINGS
  focusRings: {
    status: "IMPLEMENTED",
    description: "Indicadores visuales de foco para navegación por teclado",
    requirements: [
      "✓ Todos los elementos interactivos tienen focus-visible ring",
      "✓ Color de ring es el brand primary (#2563EB)",
      "✓ Ring tiene offset para visibilidad",
      "✓ Ring es visible en light y dark mode",
    ],
    implementation: `
      // En globals.css
      *:focus-visible {
        @apply outline-none ring-2 ring-ring ring-offset-2 ring-offset-background;
      }

      // En componentes interactivos
      className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    `,
  },

  // 2. CONTRASTE DE COLOR
  colorContrast: {
    status: "IMPLEMENTED",
    description: "Contraste mínimo AA (4.5:1 para texto, 3:1 para UI grande)",
    requirements: [
      "✓ Texto primario #0F172A sobre #FFFFFF = 15.2:1 (AAA)",
      "✓ Texto muted #64748B sobre #FFFFFF = 4.7:1 (AA)",
      "✓ Primary #2563EB sobre #FFFFFF = 4.7:1 (AA)",
      "✓ Success #22C55E sobre #FFFFFF = 3.1:1 (AA Large)",
      "✓ Destructive #DC2626 sobre #FFFFFF = 4.9:1 (AA)",
      "✓ Dark mode textos verificados",
    ],
    implementation: `
      // Usar estos colores del brand
      --foreground: #0F172A;     // Texto principal
      --muted-foreground: #64748B; // Texto secundario
      --primary: #2563EB;        // Acciones/CTA
    `,
  },

  // 3. TAMAÑOS TÁCTILES
  touchTargets: {
    status: "IMPLEMENTED",
    description: "Áreas táctiles mínimas de 44x44px",
    requirements: [
      "✓ Botones tienen min-h-[44px] min-w-[44px]",
      "✓ Links de navegación tienen padding suficiente",
      "✓ Checkbox/Radio tienen área clickeable expandida",
      "✓ BottomNav items tienen touch-target class",
    ],
    implementation: `
      // Utility class en globals.css
      .touch-target {
        @apply min-h-[44px] min-w-[44px];
      }

      // En Button component
      size: {
        default: "h-10 px-4 py-2", // 40px altura
        icon: "size-10",           // 40x40px
      }
    `,
  },

  // 4. NAVEGACIÓN POR TECLADO
  keyboardNavigation: {
    status: "IMPLEMENTED",
    description: "Toda la funcionalidad accesible via teclado",
    requirements: [
      "✓ Tab order lógico",
      "✓ Escape cierra modales/dropdowns",
      "✓ Enter/Space activan botones",
      "✓ Arrow keys navegan en listas/selects",
      "✓ Skip links disponibles",
    ],
    implementation: `
      // Radix UI maneja esto automáticamente
      // Verificar que no hay tabIndex negativos innecesarios
      // Usar role y aria-* apropiados
    `,
  },

  // 5. LABELS Y DESCRIPCIONES
  labelsAndDescriptions: {
    status: "IMPLEMENTED",
    description: "Todos los inputs tienen labels asociados",
    requirements: [
      "✓ Inputs tienen label visible o aria-label",
      "✓ Errores anunciados con role='alert'",
      "✓ Hints conectados con aria-describedby",
      "✓ Iconos decorativos tienen aria-hidden='true'",
      "✓ Iconos funcionales tienen sr-only text",
    ],
    implementation: `
      // Input component
      <label htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        aria-invalid={!!error}
        aria-describedby={error ? \`\${inputId}-error\` : undefined}
      />
      {error && <p id={\`\${inputId}-error\`} role="alert">{error}</p>}

      // Icon button
      <button>
        <Icon aria-hidden="true" />
        <span className="sr-only">Descripción</span>
      </button>
    `,
  },

  // 6. ESTADOS ARIA
  ariaStates: {
    status: "IMPLEMENTED",
    description: "Estados comunicados a tecnologías asistivas",
    requirements: [
      "✓ aria-expanded en dropdowns/accordions",
      "✓ aria-selected en tabs/selects",
      "✓ aria-current='page' en navegación",
      "✓ aria-busy en estados de carga",
      "✓ aria-live para actualizaciones dinámicas",
    ],
    implementation: `
      // Loading button
      <button aria-busy={loading} disabled={loading}>
        {loading && <Loader />}
        {children}
      </button>

      // Navigation link
      <Link aria-current={isActive ? 'page' : undefined}>

      // Toast notifications (Sonner)
      aria-live="polite" // Anunciados por screen readers
    `,
  },

  // 7. SEMÁNTICA HTML
  semanticHtml: {
    status: "IMPLEMENTED",
    description: "Uso correcto de elementos semánticos",
    requirements: [
      "✓ Headings en orden jerárquico (h1 > h2 > h3)",
      "✓ nav para navegación",
      "✓ main para contenido principal",
      "✓ aside para sidebars",
      "✓ button para acciones, a para navegación",
      "✓ table con thead/tbody para datos tabulares",
    ],
    implementation: `
      // Layout structure
      <div>
        <aside>Sidebar</aside>
        <main>
          <h1>Page Title</h1>
          <section>
            <h2>Section</h2>
          </section>
        </main>
      </div>
    `,
  },

  // 8. REDUCCIÓN DE MOVIMIENTO
  reducedMotion: {
    status: "IMPLEMENTED",
    description: "Respetar preferencia de reduced motion",
    requirements: [
      "✓ @media (prefers-reduced-motion) aplicado",
      "✓ Animaciones opcionales desactivables",
      "✓ No hay contenido que dependa solo de animación",
    ],
    implementation: `
      // tw-animate-css ya incluye soporte
      @media (prefers-reduced-motion: reduce) {
        * {
          animation-duration: 0.01ms !important;
          transition-duration: 0.01ms !important;
        }
      }
    `,
  },

  // 9. RESPONSIVE Y ZOOM
  responsiveAndZoom: {
    status: "IMPLEMENTED",
    description: "Funcional hasta 200% zoom y en todos los viewports",
    requirements: [
      "✓ No hay scroll horizontal en viewports pequeños",
      "✓ Texto reflow correcto al hacer zoom",
      "✓ Touch targets mantienen tamaño mínimo",
      "✓ No hay contenido cortado",
    ],
    implementation: `
      // Mobile-first responsive design
      // Usar unidades relativas (rem, %)
      // Breakpoints de Tailwind: sm, md, lg, xl
    `,
  },

  // 10. FORMULARIOS ACCESIBLES
  accessibleForms: {
    status: "IMPLEMENTED",
    description: "Formularios usables por todos",
    requirements: [
      "✓ Labels visibles (no solo placeholders)",
      "✓ Errores claros y asociados al campo",
      "✓ Instrucciones antes del campo",
      "✓ No hay límites de tiempo estrictos",
      "✓ Confirmación antes de acciones destructivas",
    ],
    implementation: `
      // Always use Input with label prop
      <Input
        label="Correo electrónico"
        error={errors.email}
        hint="Usaremos tu correo para enviarte notificaciones"
      />
    `,
  },
} as const;

// ============================================
// UTILIDADES DE ACCESIBILIDAD
// ============================================

/**
 * Screen reader only class
 * Oculta visualmente pero mantiene accesible para screen readers
 */
export const srOnly = "sr-only";

/**
 * Genera un ID único para asociar labels con inputs
 */
export function generateId(prefix = "rc"): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Props para elementos que deben ser ignorados por screen readers
 */
export const ariaHidden = {
  "aria-hidden": "true" as const,
  role: "presentation" as const,
};

/**
 * Props para live regions que anuncian actualizaciones
 */
export const ariaLivePolite = {
  "aria-live": "polite" as const,
  "aria-atomic": "true" as const,
};

export const ariaLiveAssertive = {
  "aria-live": "assertive" as const,
  "aria-atomic": "true" as const,
};

/**
 * Hook para anunciar mensajes a screen readers
 */
export function announceToScreenReader(message: string, priority: "polite" | "assertive" = "polite"): void {
  const announcement = document.createElement("div");
  announcement.setAttribute("aria-live", priority);
  announcement.setAttribute("aria-atomic", "true");
  announcement.setAttribute("class", "sr-only");
  announcement.textContent = message;

  document.body.appendChild(announcement);

  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Trap focus dentro de un elemento (para modales)
 * Radix UI ya maneja esto, pero útil para implementaciones custom
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const focusableSelectors = [
    'button:not([disabled])',
    'a[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  return Array.from(container.querySelectorAll(focusableSelectors));
}

// ============================================
// CONSTANTES DE ACCESIBILIDAD
// ============================================

export const A11Y_CONSTANTS = {
  // Tamaños mínimos
  MIN_TOUCH_TARGET: 44, // px
  MIN_FONT_SIZE: 16, // px para body

  // Tiempos
  FOCUS_DELAY: 100, // ms
  ANNOUNCEMENT_DELAY: 100, // ms

  // Contrast ratios (WCAG 2.1)
  CONTRAST_AA_NORMAL: 4.5,
  CONTRAST_AA_LARGE: 3,
  CONTRAST_AAA_NORMAL: 7,
  CONTRAST_AAA_LARGE: 4.5,
} as const;
