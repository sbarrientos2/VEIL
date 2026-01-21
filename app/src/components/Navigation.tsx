"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FC, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { clsx } from "clsx";

const navLinks = [
  { href: "/markets", label: "Markets" },
  { href: "/create", label: "Create" },
  { href: "/portfolio", label: "Portfolio" },
];

export const Navigation: FC = () => {
  const pathname = usePathname();
  const { connected } = useWallet();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50">
      {/* Backdrop blur */}
      <div className="absolute inset-0 bg-void-950/80 backdrop-blur-xl border-b border-void-700/50" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-10 h-10">
              {/* Logo glow */}
              <div className="absolute inset-0 bg-cipher-600 rounded-lg blur-lg opacity-50 group-hover:opacity-80 transition-opacity" />
              {/* Logo shape */}
              <div className="relative w-full h-full bg-gradient-to-br from-cipher-500 to-cipher-700 rounded-lg flex items-center justify-center">
                <span className="text-white font-display font-bold text-xl">V</span>
              </div>
            </div>
            <span className="text-xl font-display font-bold text-white tracking-tight hidden sm:block">
              VEIL
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "relative px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                  pathname === link.href
                    ? "text-white"
                    : "text-void-400 hover:text-white"
                )}
              >
                {pathname === link.href && (
                  <motion.div
                    layoutId="nav-active"
                    className="absolute inset-0 bg-cipher-600/20 border border-cipher-600/30 rounded-lg"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative">{link.label}</span>
              </Link>
            ))}
          </div>

          {/* Wallet + Mobile Toggle */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <WalletMultiButton className="!bg-cipher-600 hover:!bg-cipher-500 !rounded-lg !h-10 !text-sm !font-medium" />
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-void-400 hover:text-white transition-colors"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {mobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-void-900/95 backdrop-blur-xl border-b border-void-700/50"
          >
            <div className="px-4 py-4 space-y-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={clsx(
                    "block px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                    pathname === link.href
                      ? "bg-cipher-600/20 text-white border border-cipher-600/30"
                      : "text-void-400 hover:text-white hover:bg-void-800"
                  )}
                >
                  {link.label}
                </Link>
              ))}
              <div className="pt-2">
                <WalletMultiButton className="!w-full !bg-cipher-600 hover:!bg-cipher-500 !rounded-lg !h-12 !text-sm !font-medium !justify-center" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};
