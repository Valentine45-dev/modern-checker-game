import { useState } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import CheckerLogo from './CheckerLogo';

interface HeaderProps {
  onSettingsClick?: () => void;
}

const Header = ({ onSettingsClick }: HeaderProps) => {
  const [showProfile] = useState(false);

  return (
    <header className="flex items-center justify-between p-4 md:px-8 border-b border-primary/20 dark:border-primary/30 bg-background-dark/50 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        {/* Project brand mark — intentionally not a library icon */}
        <CheckerLogo className="w-6 h-6 text-white" />
        <h1 className="text-xl font-bold text-white">Checkers</h1>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={onSettingsClick}
          className="p-2 rounded-full bg-primary/20 dark:bg-primary/30 hover:bg-primary/40 dark:hover:bg-primary/50 transition-colors"
          aria-label="Settings"
        >
          <SettingsIcon className="w-5 h-5 text-white" aria-hidden="true" />
        </button>

        {/* Profile Avatar */}
        {showProfile && (
          <div
            className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-600 flex items-center justify-center text-white font-bold"
          >
            M
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
