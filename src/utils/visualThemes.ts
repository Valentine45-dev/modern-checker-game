import { GameSettings } from './gameSettings';

// Board theme configurations
export interface BoardTheme {
  name: string;
  lightColor: string;
  darkColor: string;
  borderColor: string;
  shadowColor: string;
  frameGradient: string;
  frameBorder: string;
}

export const BOARD_THEMES: Record<string, BoardTheme> = {
  classic: {
    name: 'Classic Wood',
    lightColor: '#EADCCF',
    darkColor: '#A98467',
    borderColor: '#8B7355',
    shadowColor: 'rgba(0,0,0,0.3)',
    frameGradient: 'from-amber-900 via-amber-800 to-amber-900',
    frameBorder: 'border-amber-700'
  },
  modern: {
    name: 'Modern Glass',
    lightColor: '#F8FAFC',
    darkColor: '#475569',
    borderColor: '#334155',
    shadowColor: 'rgba(0,0,0,0.1)',
    frameGradient: 'from-slate-800 via-slate-700 to-slate-800',
    frameBorder: 'border-slate-600'
  },
  marble: {
    name: 'Marble',
    lightColor: '#F7F3F0',
    darkColor: '#8B7D6B',
    borderColor: '#6B5B47',
    shadowColor: 'rgba(0,0,0,0.2)',
    frameGradient: 'from-stone-800 via-stone-700 to-stone-800',
    frameBorder: 'border-stone-600'
  },
  neon: {
    name: 'Neon',
    lightColor: '#0F172A',
    darkColor: '#1E293B',
    borderColor: '#3B82F6',
    shadowColor: 'rgba(59, 130, 246, 0.3)',
    frameGradient: 'from-blue-900 via-blue-800 to-blue-900',
    frameBorder: 'border-blue-500'
  }
};

// Piece style configurations
export interface PieceStyle {
  name: string;
  redColor: string;
  redBorder: string;
  redShadow: string;
  blackColor: string;
  blackBorder: string;
  blackShadow: string;
  kingIcon: string;
  kingColor: string;
  hoverEffect: string;
  selectedEffect: string;
}

export const PIECE_STYLES: Record<string, PieceStyle> = {
  standard: {
    name: 'Standard',
    redColor: 'bg-red-600',
    redBorder: 'border-red-800',
    redShadow: 'shadow-red-900/50',
    blackColor: 'bg-gray-300 dark:bg-gray-600',
    blackBorder: 'border-gray-500 dark:border-gray-700',
    blackShadow: 'shadow-gray-900/50',
    kingIcon: 'text-yellow-400',
    kingColor: 'text-yellow-400',
    hoverEffect: 'hover:scale-110',
    selectedEffect: 'ring-blue-500'
  },
  minimal: {
    name: 'Minimal',
    redColor: 'bg-red-500',
    redBorder: 'border-red-600',
    redShadow: 'shadow-red-800/30',
    blackColor: 'bg-gray-400 dark:bg-gray-500',
    blackBorder: 'border-gray-600 dark:border-gray-400',
    blackShadow: 'shadow-gray-800/30',
    kingIcon: 'text-yellow-300',
    kingColor: 'text-yellow-300',
    hoverEffect: 'hover:scale-105',
    selectedEffect: 'ring-blue-400'
  },
  detailed: {
    name: 'Detailed',
    redColor: 'bg-gradient-to-br from-red-500 to-red-700',
    redBorder: 'border-red-900',
    redShadow: 'shadow-red-900/60',
    blackColor: 'bg-gradient-to-br from-gray-400 to-gray-600 dark:from-gray-500 dark:to-gray-700',
    blackBorder: 'border-gray-800 dark:border-gray-600',
    blackShadow: 'shadow-gray-900/60',
    kingIcon: 'text-yellow-300',
    kingColor: 'text-yellow-300',
    hoverEffect: 'hover:scale-115',
    selectedEffect: 'ring-blue-600'
  },
  retro: {
    name: 'Retro',
    redColor: 'bg-orange-500',
    redBorder: 'border-orange-700',
    redShadow: 'shadow-orange-800/50',
    blackColor: 'bg-purple-600 dark:bg-purple-700',
    blackBorder: 'border-purple-800 dark:border-purple-900',
    blackShadow: 'shadow-purple-900/50',
    kingIcon: 'text-yellow-200',
    kingColor: 'text-yellow-200',
    hoverEffect: 'hover:scale-110',
    selectedEffect: 'ring-cyan-400'
  }
};

// Get current board theme
export function getBoardTheme(settings: GameSettings): BoardTheme {
  return BOARD_THEMES[settings.boardTheme] || BOARD_THEMES.classic;
}

// Get current piece style
export function getPieceStyle(settings: GameSettings): PieceStyle {
  return PIECE_STYLES[settings.pieceStyle] || PIECE_STYLES.standard;
}

// Get board square color based on theme and position
export function getSquareColor(theme: BoardTheme, isLight: boolean): string {
  return isLight ? theme.lightColor : theme.darkColor;
}

// Get piece classes based on style and piece properties
export function getPieceClasses(
  style: PieceStyle, 
  piece: { color: 'red' | 'black'; type: 'normal' | 'king' },
  isSelected: boolean,
  isShaking: boolean,
  hasCapture: boolean,
  animationsEnabled: boolean
): string {
  const baseClasses = "w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full shadow-lg cursor-pointer transition-all duration-200 active:scale-95";
  
  // Color classes based on piece color
  const colorClasses = piece.color === 'red' 
    ? `${style.redColor} border-2 sm:border-3 ${style.redBorder} ${style.redShadow}` 
    : `${style.blackColor} border-2 sm:border-3 ${style.blackBorder} ${style.blackShadow}`;
  
  // Selection effect
  const selectedClasses = isSelected ? `ring-2 sm:ring-4 ${style.selectedEffect} ring-offset-2 ring-offset-transparent scale-110` : "";
  
  // Animation effects
  const shakeClasses = isShaking && animationsEnabled ? "animate-shake-no" : "";
  const captureGlowClasses = hasCapture && !isSelected && animationsEnabled ? "animate-capture-glow" : "";
  
  // Hover effect
  const hoverClasses = style.hoverEffect;
  
  return `${baseClasses} ${colorClasses} ${selectedClasses} ${shakeClasses} ${captureGlowClasses} ${hoverClasses} flex items-center justify-center relative`;
}

// Get king icon classes
export function getKingIconClasses(style: PieceStyle): string {
  return `w-4 h-4 sm:w-6 sm:h-6 ${style.kingColor} drop-shadow-lg`;
}

// Get board frame classes
export function getBoardFrameClasses(theme: BoardTheme): string {
  return `bg-gradient-to-br ${theme.frameGradient} p-4 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.25)] border-4 ${theme.frameBorder}`;
}

// Get board grid classes
export function getBoardGridClasses(theme: BoardTheme): string {
  return `aspect-square w-full grid grid-cols-8 grid-rows-8 gap-0 rounded-lg overflow-hidden border-4 ${theme.frameBorder}`;
}
