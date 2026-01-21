"use client";

import { FC } from "react";
import Link from "next/link";

export const Footer: FC = () => {
  return (
    <footer className="relative border-t border-void-700/50 bg-void-950/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-cipher-500 to-cipher-700 rounded-lg flex items-center justify-center">
                <span className="text-white font-display font-bold">V</span>
              </div>
              <span className="text-lg font-display font-bold text-white">
                VEIL
              </span>
            </div>
            <p className="text-void-400 text-sm max-w-md">
              Private parimutuel prediction markets powered by Arcium MPC.
              Your bets stay encrypted until resolution.
            </p>
            <div className="mt-4 font-mono text-xs text-cipher-600">
              Built on Solana
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-sm font-medium text-white mb-4">Platform</h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/markets"
                  className="text-void-400 text-sm hover:text-cipher-400 transition-colors"
                >
                  Browse Markets
                </Link>
              </li>
              <li>
                <Link
                  href="/create"
                  className="text-void-400 text-sm hover:text-cipher-400 transition-colors"
                >
                  Create Market
                </Link>
              </li>
              <li>
                <Link
                  href="/portfolio"
                  className="text-void-400 text-sm hover:text-cipher-400 transition-colors"
                >
                  My Portfolio
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-sm font-medium text-white mb-4">Resources</h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://docs.arcium.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-void-400 text-sm hover:text-cipher-400 transition-colors"
                >
                  Arcium Docs
                </a>
              </li>
              <li>
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-void-400 text-sm hover:text-cipher-400 transition-colors"
                >
                  GitHub
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t border-void-800">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-void-500 text-xs">
              &copy; {new Date().getFullYear()} VEIL. All rights reserved.
            </p>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-void-600">Network:</span>
              <span className="px-2 py-1 bg-cipher-900/30 text-cipher-400 rounded font-mono">
                devnet
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
