import React from 'react';
import { ASSETS_CONFIG } from '../config/assets';

interface CharacterIllustrationProps {
  className?: string;
  size?: number;
}

/**
 * Representación 2D Cartoon Moderna y fiel del asset de referencia de "The Hacker":
 * - Joven informático simpático y expresivo
 * - Gorra moderna blanca y negra
 * - Pelo castaño asomando bajo la gorra
 * - Gafas de pasta negra rectangulares
 * - Sudadera azul marino con cordón/lanyard multicolor y tarjeta acreditativa (ID badge)
 * - Reloj digital cyan en la muñeca derecha y tablet con pantalla verde Matrix en la mano izquierda
 * - Pantalones cargo oscuros y zapatillas deportivas azules, blancas y negras
 * Si el usuario asigna ASSETS_CONFIG.player.referenceImageUrl, renderiza automáticamente ese archivo.
 */
export const CharacterIllustration: React.FC<CharacterIllustrationProps> = ({
  className = '',
  size = 180,
}) => {
  if (ASSETS_CONFIG.player.referenceImageUrl) {
    return (
      <img
        src={ASSETS_CONFIG.player.referenceImageUrl}
        alt="The Hacker"
        style={{ width: size, height: size }}
        className={`object-contain drop-shadow-[0_0_20px_rgba(0,229,255,0.45)] ${className}`}
      />
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 260 310"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`drop-shadow-[0_0_22px_rgba(0,229,255,0.38)] ${className}`}
    >
      {/* Halo de energía tecnológica detrás */}
      <ellipse cx="130" cy="285" rx="68" ry="12" fill="#00E5FF" fillOpacity="0.22" />
      <circle cx="130" cy="145" r="95" stroke="#00E5FF" strokeOpacity="0.16" strokeWidth="2" strokeDasharray="8 6" />

      {/* PIERNAS: Vaqueros/Cargo negros oscuros (#1B202B) */}
      <path
        d="M98 188 L86 258 L112 260 L124 202 L136 202 L148 260 L174 258 L162 188 Z"
        fill="#1E2433"
        stroke="#0A0E17"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      {/* Bolsillo cargo lateral */}
      <rect x="87" y="212" width="16" height="22" rx="4" fill="#151924" stroke="#0A0E17" strokeWidth="3.5" />
      {/* Pliegues de rodilla */}
      <path d="M96 235 H110 M150 235 H164" stroke="#2D364B" strokeWidth="3" strokeLinecap="round" />

      {/* ZAPATILLAS DEPORTIVAS AZULES, BLANCAS Y CYAN */}
      {/* Zapatilla Izquierda */}
      <g>
        <path
          d="M78 258 C78 252, 114 252, 116 260 L118 278 C118 282, 72 282, 72 276 Z"
          fill="#1E40AF"
          stroke="#0A0E17"
          strokeWidth="4.5"
        />
        <rect x="84" y="252" width="20" height="10" rx="3" fill="#00E5FF" stroke="#0A0E17" strokeWidth="3" />
        <path d="M72 275 H118" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" />
      </g>
      {/* Zapatilla Derecha */}
      <g>
        <path
          d="M144 258 C146 252, 184 252, 188 264 L192 278 C192 282, 142 282, 142 276 Z"
          fill="#1E40AF"
          stroke="#0A0E17"
          strokeWidth="4.5"
        />
        <rect x="154" y="252" width="20" height="10" rx="3" fill="#00E5FF" stroke="#0A0E17" strokeWidth="3" />
        <path d="M142 275 H192" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" />
      </g>

      {/* SUDADERA AZUL MARINO CON CAPUCHA (#243B61) */}
      <path
        d="M94 114 C78 120, 68 148, 66 164 L84 170 L94 148 L94 190 L166 190 L166 148 L178 168 L194 156 C188 136, 178 118, 166 114 Z"
        fill="#243B61"
        stroke="#0A0E17"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      {/* Capucha en el cuello */}
      <path
        d="M98 110 C98 124, 162 124, 162 110"
        fill="#1B2D4B"
        stroke="#0A0E17"
        strokeWidth="4.5"
      />
      {/* Bolsillo canguro */}
      <path
        d="M104 164 H156 L162 186 H98 Z"
        fill="#1D3152"
        stroke="#0A0E17"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />

      {/* LANYARD MULTICOLOR Y TARJETA DE IDENTIFICACIÓN (ID BADGE) */}
      <path d="M114 118 L128 152" stroke="#00E5FF" strokeWidth="4" strokeLinecap="round" />
      <path d="M146 118 L132 152" stroke="#00FF66" strokeWidth="4" strokeLinecap="round" />
      <rect x="120" y="150" width="20" height="26" rx="4" fill="#F8FAFC" stroke="#0A0E17" strokeWidth="3.5" />
      <rect x="124" y="155" width="12" height="9" rx="2" fill="#00E5FF" />
      <line x1="124" y1="169" x2="136" y2="169" stroke="#1E293B" strokeWidth="2.5" />

      {/* MANO DERECHA SALUDANDO + RELOJ INTELIGENTE CYAN */}
      <rect x="64" y="152" width="16" height="10" rx="3" transform="rotate(-20 64 152)" fill="#00E5FF" stroke="#0A0E17" strokeWidth="3" />
      <circle cx="66" cy="144" r="11" fill="#FDBA8C" stroke="#0A0E17" strokeWidth="4" />
      <path d="M58 136 L55 126 M64 134 L63 123 M71 135 L73 125" stroke="#FDBA8C" strokeWidth="5" strokeLinecap="round" />

      {/* TABLET FUTURISTA CON PANTALLA VERDE MATRIX EN LA MANO IZQUIERDA */}
      <g transform="rotate(-14 195 148)">
        <rect x="172" y="126" width="44" height="34" rx="6" fill="#334155" stroke="#0A0E17" strokeWidth="4.5" />
        <rect x="178" y="131" width="32" height="24" rx="3" fill="#00FF66" />
        <path d="M182 137 H202 M182 143 H196 M182 149 H205" stroke="#050811" strokeWidth="2.5" strokeLinecap="round" />
      </g>
      <circle cx="192" cy="156" r="9" fill="#FDBA8C" stroke="#0A0E17" strokeWidth="4" />

      {/* CABEZA Y ROSTRO EXPRESIVO CARTOON */}
      {/* Pelo castaño lateral */}
      <path
        d="M88 64 C74 72, 76 94, 90 98 C92 84, 94 72, 94 64 Z"
        fill="#5C3317"
        stroke="#0A0E17"
        strokeWidth="4"
      />
      <path
        d="M172 64 C186 72, 184 94, 170 98 C168 84, 166 72, 166 64 Z"
        fill="#5C3317"
        stroke="#0A0E17"
        strokeWidth="4"
      />
      {/* Cara */}
      <rect x="92" y="54" width="76" height="62" rx="26" fill="#FDBA8C" stroke="#0A0E17" strokeWidth="5" />
      {/* Flequillo castaño */}
      <path
        d="M96 62 Q115 74 132 62 Q148 74 164 62"
        fill="none"
        stroke="#5C3317"
        strokeWidth="8"
        strokeLinecap="round"
      />

      {/* GAFAS DE PASTA NEGRA (ESTILO GEEK/INFORMÁTICO) */}
      <rect x="98" y="68" width="28" height="20" rx="5" fill="#00E5FF" fillOpacity="0.18" stroke="#0A0E17" strokeWidth="5" />
      <rect x="134" y="68" width="28" height="20" rx="5" fill="#00E5FF" fillOpacity="0.18" stroke="#0A0E17" strokeWidth="5" />
      <line x1="126" y1="77" x2="134" y2="77" stroke="#0A0E17" strokeWidth="5" />
      {/* Ojos brillantes */}
      <circle cx="113" cy="78" r="4.5" fill="#2A1810" />
      <circle cx="147" cy="78" r="4.5" fill="#2A1810" />
      <circle cx="114.5" cy="76.5" r="1.8" fill="#FFFFFF" />
      <circle cx="148.5" cy="76.5" r="1.8" fill="#FFFFFF" />

      {/* Sonrisa simpática */}
      <path
        d="M118 97 Q130 107 142 97 Z"
        fill="#FFFFFF"
        stroke="#0A0E17"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />

      {/* GORRA MODERNA BLANCA Y NEGRA */}
      {/* Copa negra */}
      <path
        d="M90 58 C90 22, 170 22, 170 58 Z"
        fill="#111827"
        stroke="#0A0E17"
        strokeWidth="5"
      />
      {/* Panel frontal blanco */}
      <path
        d="M104 56 C104 28, 156 28, 156 56 Z"
        fill="#F8FAFC"
        stroke="#0A0E17"
        strokeWidth="4"
      />
      {/* Visera curvada negra con borde azul eléctrico */}
      <path
        d="M86 55 Q130 44 184 58 Q186 66 164 66 Q130 56 90 62 Z"
        fill="#0F172A"
        stroke="#0A0E17"
        strokeWidth="4.5"
      />
    </svg>
  );
};
