# Checkers Master ♟️

A professional 8x8 checker game built with React, TypeScript, and Tailwind CSS featuring advanced AI opponents, smooth animations, and complete game persistence.

## ✨ Features

### 🎮 Game Modes
- **Player vs Player** - Local multiplayer
- **vs AI Easy** - Perfect for beginners
- **vs AI Medium** - Balanced challenge
- **vs AI Hard** - For experienced players

### 🧠 Advanced AI Engine
- Minimax algorithm with Alpha-Beta pruning
- Multiple difficulty levels with strategic evaluation
- Smart move calculation and multi-jump handling
- Realistic thinking time with progress indicators

### 🎯 International Checkers Rules
- Complete 8x8 board implementation
- Flying kings with unlimited diagonal movement
- Multi-jump captures with mandatory continuation
- King promotion at opposite end
- Mandatory capture enforcement

### 🎨 Visual Excellence
- **Shake Animation** - Pieces shake when invalid moves are attempted
- **Capture Glow** - Golden pulsing glow around pieces with mandatory captures
- **Smooth Transitions** - Hover effects and piece animations
- **Toast Notifications** - Real-time feedback for all game events
- **Glassmorphism UI** - Modern design with backdrop blur effects

### 💾 Complete Game Persistence
- **Auto-Save** - Every move automatically saved to localStorage
- **Resume Game** - Continue exactly where you left off
- **Smart Detection** - Automatically detects saved games on app load
- **Cross-Session** - Works across browser tabs and sessions
- **Mode Validation** - Ensures saved games match current mode

### 📊 Game Statistics
- Move history with detailed notation
- Pieces captured counter
- Kings promoted tracking
- Game duration timer
- Performance ratings and victory messages

### 🎵 User Experience
- Responsive design for all screen sizes
- Professional Git workflow with semantic commits
- Comprehensive error handling
- Accessibility-friendly interface
- Dark theme with subtle patterns

## 🚀 Getting Started

### Prerequisites
- Node.js 16+ 
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd checker

# Install dependencies
npm install

# Start development server
npm run dev
```

### Available Scripts

```bash
# Development
npm run dev          # Start dev server (http://localhost:5173)

# Production
npm run build        # Build for production
npm run preview      # Preview production build

# Code Quality
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript checks
```

## 🏗️ Tech Stack

- **React 18** - Modern UI library with hooks
- **TypeScript** - Full type safety and IntelliSense
- **Tailwind CSS** - Utility-first styling framework
- **Vite** - Lightning-fast build tool
- **ESLint** - Code quality and consistency

## 📁 Project Architecture

```
src/
├── components/           # React components
│   ├── Game.tsx         # Main game orchestrator
│   ├── Board.tsx        # 8x8 checkerboard
│   ├── Square.tsx       # Individual board squares
│   ├── Piece.tsx        # Checker pieces with animations
│   ├── GameInfo.tsx     # Player stats and timers
│   ├── Controls.tsx     # Game control buttons
│   ├── MoveHistory.tsx  # Move history display
│   ├── MainMenu.tsx     # Main menu with resume
│   ├── GameModeSelection.tsx # Mode selection screen
│   └── ToastNotification.tsx # Notification system
├── utils/               # Utility functions
│   ├── aiEngine.ts      # AI logic and algorithms
│   └── gamePersistence.ts # Save/load functionality
├── types/               # TypeScript definitions
│   └── index.ts         # Game state types
├── App.tsx             # Main app component
├── main.tsx           # Application entry point
└── index.css          # Global styles and animations
```

## 🎯 Key Components

### Game Component
- Manages complete game state
- Handles move validation and execution
- Integrates AI opponent logic
- Auto-saves game progress
- Provides visual feedback

### AI Engine
- **Minimax Algorithm** - Strategic move calculation
- **Alpha-Beta Pruning** - Performance optimization
- **Heuristic Evaluation** - Board position scoring
- **Multi-Jump Handling** - Complex capture sequences
- **Difficulty Scaling** - Adjustable challenge levels

### Persistence System
- **localStorage Integration** - Browser-based storage
- **State Serialization** - Complete game state saving
- **Validation** - Data integrity checks
- **Error Recovery** - Graceful failure handling

## 🎨 Animations & Effects

### Shake Animation
```css
@keyframes shake-no {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
  20%, 40%, 60%, 80% { transform: translateX(8px); }
}
```

### Capture Glow
```css
@keyframes capture-glow {
  0%, 100% { box-shadow: 0 0 10px 2px rgba(234, 179, 8, 0.3); }
  50% { box-shadow: 0 0 20px 4px rgba(234, 179, 8, 0.6); }
}
```

## 🔧 Configuration

### AI Difficulty Settings
- **Easy**: Depth 2, High randomness
- **Medium**: Depth 3, Medium randomness  
- **Hard**: Depth 4, Low randomness

### Game Rules
- 8x8 International Checkers
- Flying kings with unlimited movement
- Mandatory captures enforced
- Multi-jump sequences supported

## 🎮 How to Play

1. **Start Game** - Choose PvP or AI difficulty
2. **Make Moves** - Click piece, then destination square
3. **Captures** - Jump over opponent pieces (mandatory)
4. **Kings** - Reach opposite end to promote
5. **Win** - Capture all opponent pieces or block all moves

## 🚀 Deployment

```bash
# Build for production
npm run build

# Deploy dist/ folder to your hosting service
# Works with Vercel, Netlify, GitHub Pages, etc.
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'feat: add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📝 License

MIT License - feel free to use this project for learning and development!

---

**Built with ❤️ using React, TypeScript, and Tailwind CSS**

