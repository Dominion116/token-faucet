import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Menu, X, LogOut, Wallet, ExternalLink } from 'lucide-react';

export default function Navbar({ userData, onConnect, onLogout }) {
  const [isOpen, setIsOpen] = useState(false);

  const walletAddress = userData?.profile?.stxAddress?.testnet || '';

  return (
    <nav className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between max-w-4xl">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
            <span className="text-white font-bold text-sm">§</span>
          </div>
          <span className="text-lg font-semibold text-foreground">
            STX Faucet
          </span>
        </div>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-2">
          <a 
            href="https://explorer.hiro.so/?chain=testnet" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            Explorer <ExternalLink className="h-3 w-3" />
          </a>

          {userData ? (
            <div className="flex items-center gap-2 ml-2">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary/50 rounded-lg border border-border/50">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-mono text-foreground">
                  {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                </span>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onLogout}
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button 
              onClick={onConnect} 
              size="sm" 
              className="ml-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 border-0 text-white"
            >
              <Wallet className="mr-2 h-4 w-4" />
              Connect
            </Button>
          )}
        </div>

        {/* Mobile Toggle */}
        <button 
          className="md:hidden text-foreground p-2"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden border-t border-border/50 bg-background/95 backdrop-blur-xl px-4 py-4 space-y-3">
          <a 
            href="https://explorer.hiro.so/?chain=testnet" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="py-2 text-sm text-muted-foreground hover:text-foreground flex items-center gap-2"
          >
            Explorer <ExternalLink className="h-3 w-3" />
          </a>

          <div className="pt-3 border-t border-border/50">
            {userData ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-3 py-2 bg-secondary/50 rounded-lg">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-mono text-foreground">{walletAddress.slice(0, 10)}...{walletAddress.slice(-6)}</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onLogout} 
                  className="w-full justify-start text-muted-foreground"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button 
                onClick={onConnect} 
                className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 border-0"
              >
                <Wallet className="mr-2 h-4 w-4" />
                Connect Wallet
              </Button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
