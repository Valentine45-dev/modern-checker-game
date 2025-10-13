import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-white mb-8">
          Checker Game
        </h1>
        <p className="text-xl text-gray-300 mb-4">
          Welcome to the 8x8 Checker Game
        </p>
        <button
          onClick={() => setCount((count) => count + 1)}
          className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg shadow-lg transition-colors"
        >
          Count: {count}
        </button>
      </div>
    </div>
  )
}

export default App

