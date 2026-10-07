import React from 'react';

export type LogoVariant = 'layers' | 'prism' | 'hexagon';

interface ChromaTestLogoProps {
  color?: string;
  size?: number;
  className?: string;
  variant?: LogoVariant;
  withHalo?: boolean;
}

/**
 * ChromaTestLogo: Eigenes Vektor-Logo speziell zum Testen der Erkennbarkeit
 * und Kontrast-Differenzierung bei identischer Tab- und Favicon-Farbe.
 */
export const ChromaTestLogo: React.FC<ChromaTestLogoProps> = ({
  color = '#ff4f5e',
  size = 20,
  className = '',
  variant = 'layers',
  withHalo = false,
}) => {
  const haloStyle = withHalo 
    ? { filter: 'drop-shadow(0 0 1.5px rgba(255, 255, 255, 0.95)) drop-shadow(0 0 3px rgba(0, 0, 0, 0.6))' } 
    : undefined;

  if (variant === 'prism') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={haloStyle}
      >
        {/* Prism Top Facet */}
        <polygon
          points="12,2 21,7.5 12,13 3,7.5"
          fill={color}
          fillOpacity="0.4"
          stroke={color}
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        {/* Left Facet */}
        <polygon
          points="3,7.5 12,13 12,22 3,16.5"
          fill={color}
          fillOpacity="0.2"
          stroke={color}
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        {/* Right Facet */}
        <polygon
          points="12,13 21,7.5 21,16.5 12,22"
          fill={color}
          fillOpacity="0.6"
          stroke={color}
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        {/* Center glowing core point */}
        <circle cx="12" cy="13" r="1.5" fill="#ffffff" />
      </svg>
    );
  }

  if (variant === 'hexagon') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={haloStyle}
      >
        <polygon
          points="12,2 20.66,7 20.66,17 12,22 3.34,17 3.34,7"
          fill={color}
          fillOpacity="0.25"
          stroke={color}
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="3.5" stroke={color} strokeWidth="1.5" fill={color} fillOpacity="0.5" />
        <path d="M12 2v6.5 M20.66 17L15 13.5 M3.34 17L9 13.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  // Default 'layers': Isometrische Schichten / Stacked Plates (entspricht dem Screenshot des Nutzers)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={haloStyle}
    >
      {/* Oberste Schicht (Top Diamond Slab) */}
      <polygon
        points="12,2.5 20,6.75 12,11 4,6.75"
        fill={color}
        fillOpacity="0.35"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      
      {/* Mittlere Schicht (Front Lip & Ridge) */}
      <path
        d="M4 10.75 L12 15 L20 10.75"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 10.75 v2 L12 17 L20 12.75 v-2"
        stroke={color}
        strokeWidth="1.3"
        strokeLinejoin="round"
        fill={color}
        fillOpacity="0.2"
      />

      {/* Untere Schicht (Bottom Foundation) */}
      <path
        d="M4 15.25 L12 19.5 L20 15.25"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 15.25 v2 L12 21.5 L20 17.25 v-2"
        stroke={color}
        strokeWidth="1.3"
        strokeLinejoin="round"
        fill={color}
        fillOpacity="0.25"
      />
    </svg>
  );
};
