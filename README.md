# Checkers Master ♟️

A professional 8x8 checker game built with React, TypeScript, and Tailwind CSS featuring advanced AI opponents, comprehensive settings, sound effects, visual themes, and complete game persistence.

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
- AI move comments and strategic feedback

### 🎯 International Checkers Rules
- Complete 8x8 board implementation
- Flying kings with unlimited diagonal movement
- Multi-jump captures with mandatory continuation
- King promotion at opposite end
- Mandatory capture enforcement

### 🎨 Visual Excellence & Themes
- **4 Board Themes**: Classic Wood, Modern Glass, Marble, Neon
- **4 Piece Styles**: Standard, Minimal, Detailed, Retro
- **Shake Animation** - Pieces shake when invalid moves are attempted
- **Capture Glow** - Golden pulsing glow around pieces with mandatory captures
- **Smooth Transitions** - Hover effects and piece animations
- **Toast Notifications** - Real-time feedback for all game events
- **Glassmorphism UI** - Modern design with backdrop blur effects

### 🔊 Sound Effects System
- **Web Audio API** - High-quality synthesized sounds
- **Game Event Sounds** - Moves, captures, king promotion, invalid moves
- **AI Move Sounds** - Distinct audio feedback for AI actions
- **Multi-Jump Sounds** - Special audio for capture sequences
- **Volume Control** - Adjustable sound levels (0-100%)
- **Enable/Disable** - Toggle sound effects on/off
- **Test Sound** - Preview audio in settings

### ⚙️ Comprehensive Settings
- **Audio Settings** - Sound effects toggle and volume control
- **Visual Settings** - Board themes and piece styles
- **Gameplay Settings** - Auto-save, AI difficulty, game speed
- **UI Settings** - Move hints and capture indicators
- **Data Management** - Reset settings and clear all data
- **Real-time Updates** - Settings apply immediately

### 📚 How to Play Guide
- **Complete Rules** - Detailed game instructions
- **Visual Indicators** - Understanding UI feedback
- **Pro Tips** - Strategic advice for players
- **Game Controls** - How to interact with the game
- **Advanced Features** - Multi-jump and flying kings explained

### 💾 Complete Game Persistence
- **Auto-Save** - Every move automatically saved to localStorage
- **Resume Game** - Continue exactly where you left off
- **Visual Settings Persistence** - Board themes and piece styles saved
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
- Custom confirmation dialogs

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
- **Web Audio API** - High-quality sound synthesis
- **localStorage** - Browser-based data persistence
- **CSS Animations** - Smooth visual effects and transitions

## 📁 Project Architecture

```
src/
├── components/           # React components
│   ├── Game.tsx         # Main game orchestrator
│   ├── Board.tsx        # 8x8 checkerboard with themes
│   ├── Square.tsx       # Individual board squares
│   ├── Piece.tsx        # Checker pieces with animations & styles
│   ├── GameInfo.tsx     # Player stats and timers
│   ├── Controls.tsx     # Game control buttons
│   ├── MoveHistory.tsx  # Move history display
│   ├── MainMenu.tsx     # Main menu with resume
│   ├── GameModeSelection.tsx # Mode selection screen
│   ├── ToastNotification.tsx # Notification system
│   ├── HowToPlay.tsx    # Game rules and instructions
│   └── Settings.tsx     # Comprehensive settings page
├── utils/               # Utility functions
│   ├── aiEngine.ts      # AI logic and algorithms
│   ├── gamePersistence.ts # Save/load functionality
│   ├── gameSettings.ts  # Settings management
│   ├── soundManager.ts  # Web Audio API sound system
│   └── visualThemes.ts  # Board themes and piece styles
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
- Auto-saves game progress with visual settings
- Provides visual feedback and animations
- Integrates sound effects and visual themes

### AI Engine
- **Minimax Algorithm** - Strategic move calculation
- **Alpha-Beta Pruning** - Performance optimization
- **Heuristic Evaluation** - Board position scoring
- **Multi-Jump Handling** - Complex capture sequences
- **Difficulty Scaling** - Adjustable challenge levels
- **Move Comments** - Strategic feedback for AI moves

### Sound System
- **Web Audio API** - High-quality synthesized sounds
- **Event-Based Audio** - Sounds for all game events
- **Volume Control** - Adjustable audio levels
- **Audio Context Management** - Proper initialization and cleanup
- **Cross-Browser Compatibility** - Works on all modern browsers

### Visual Themes System
- **Board Themes** - 4 distinct visual styles
- **Piece Styles** - 4 different piece appearances
- **Dynamic Application** - Real-time theme switching
- **Persistence** - Themes saved with game state
- **Responsive Design** - Themes work on all screen sizes

### Settings Management
- **Comprehensive Settings** - Audio, visual, gameplay options
- **Real-time Updates** - Settings apply immediately
- **Data Persistence** - Settings saved to localStorage
- **Reset Functionality** - Restore default settings
- **Data Management** - Clear all saved data

### Persistence System
- **localStorage Integration** - Browser-based storage
- **State Serialization** - Complete game state saving
- **Visual Settings Persistence** - Board themes and piece styles
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
- **Easy**: Depth 2, High randomness, 1-2s thinking time
- **Medium**: Depth 3, Medium randomness, 2-3s thinking time
- **Hard**: Depth 4, Low randomness, 3-4s thinking time

### Visual Themes
- **Classic Wood**: Traditional brown wooden board
- **Modern Glass**: Sleek glass-like appearance
- **Marble**: Elegant marble texture
- **Neon**: Futuristic neon colors

### Piece Styles
- **Standard**: Classic checker appearance
- **Minimal**: Clean, simple design
- **Detailed**: Rich, textured pieces
- **Retro**: Vintage-inspired look

### Sound Settings
- **Volume Control**: 0-100% adjustable
- **Enable/Disable**: Toggle all sound effects
- **Event Sounds**: Moves, captures, promotions, invalid moves
- **AI Sounds**: Distinct audio for AI actions

### Game Rules
- 8x8 International Checkers
- Flying kings with unlimited movement
- Mandatory captures enforced
- Multi-jump sequences supported

## 🎮 How to Play

1. **Start Game** - Choose PvP or AI difficulty
2. **Customize Experience** - Access Settings for themes, sounds, and preferences
3. **Make Moves** - Click piece, then destination square
4. **Captures** - Jump over opponent pieces (mandatory)
5. **Kings** - Reach opposite end to promote
6. **Multi-Jumps** - Continue capturing in sequence
7. **Win** - Capture all opponent pieces or block all moves
8. **Resume** - Continue saved games from main menu

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

**Built with ❤️ using React, TypeScript, Tailwind CSS, Web Audio API, and modern web technologies**

