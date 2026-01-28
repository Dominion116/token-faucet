import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Menu, X, LogOut, Wallet, Github, ExternalLink } from 'lucide-react';

export default function Navbar({ userData, onConnect, onLogout }) {
  const [isOpen, setIsOpen] = useState(false);

  const walletAddress = userData?.profile?.stxAddress?.testnet || '';

  return (
    <nav className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
            <span className="text-primary font-bold text-lg">§</span>
          </div>
          <span className="text-xl font-bold text-foreground">
            STX Faucet
          </span>
        </div>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-6">
          <a href="#" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
            Home
          </a>
          <a 
            href="https://explorer.hiro.so/?chain=testnet" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
          >
            Explorer <ExternalLink className="h-3 w-3" />
          </a>
          <a 
            href="https://github.com/stacks-network" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
          >
            GitHub <Github className="h-3 w-3" />
          </a>
          
          <div className="w-px h-6 bg-border mx-2" />

          {userData ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-full border border-border">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-mono text-secondary-foreground">
                  {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={onLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button onClick={onConnect} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Wallet className="mr-2 h-4 w-4" />
              Connect Wallet
            </Button>
          )}
        </div>

        {/* Mobile Toggle */}
        <button 
          className="md:hidden text-foreground"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden border-t border-border bg-background px-4 py-4 space-y-4">
          <a href="#" className="block text-sm font-medium text-foreground hover:text-primary">
            Home
          </a>
          <a 
            href="https://explorer.hiro.so/?chain=testnet" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="block text-sm font-medium text-muted-foreground hover:text-primary flex items-center gap-2"
          >
            Explorer <ExternalLink className="h-3 w-3" />
          </a>
          <a 
            href="https://github.com/stacks-network" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="block text-sm font-medium text-muted-foreground hover:text-primary flex items-center gap-2"
          >
            GitHub <Github className="h-3 w-3" />
          </a>

          <div className="pt-4 border-t border-border">
            {userData ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-mono">{walletAddress}</span>
                </div>
                <Button variant="destructive" size="sm" onClick={onLogout} className="w-full">
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button onClick={onConnect} className="w-full">
                Connect Wallet
              </Button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
