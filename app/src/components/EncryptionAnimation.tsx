"use client";

import { FC, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";

function scrambleText(text: string, progress: number): string {
  return text
    .split("")
    .map((char, i) => {
      if (char === " ") return " ";
      const threshold = i / text.length;
      if (progress > threshold) {
        return characters[Math.floor(Math.random() * characters.length)];
      }
      return char;
    })
    .join("");
}

export const EncryptionAnimation: FC = () => {
  const [stage, setStage] = useState<"plain" | "encrypting" | "encrypted">("plain");
  const [displayText, setDisplayText] = useState("$1,000 on YES");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const cycle = () => {
      // Start plain
      setStage("plain");
      setDisplayText("$1,000 on YES");
      setProgress(0);

      // After 2s, start encrypting
      setTimeout(() => {
        setStage("encrypting");
        let p = 0;
        const interval = setInterval(() => {
          p += 0.05;
          setProgress(p);
          setDisplayText(scrambleText("$1,000 on YES", p));
          if (p >= 1) {
            clearInterval(interval);
            setStage("encrypted");
            setDisplayText("█".repeat(14));
          }
        }, 50);
      }, 2000);

      // After 5s, start over
      setTimeout(() => {
        cycle();
      }, 6000);
    };

    cycle();
    return () => {};
  }, []);

  return (
    <div className="relative">
      {/* Card container */}
      <motion.div
        className="relative p-8 rounded-2xl bg-void-800/80 backdrop-blur-sm border border-void-600/50 overflow-hidden"
        animate={{
          borderColor:
            stage === "encrypted"
              ? "rgba(124, 58, 237, 0.5)"
              : "rgba(20, 20, 31, 0.5)",
          boxShadow:
            stage === "encrypted"
              ? "0 0 60px -15px rgba(124, 58, 237, 0.5)"
              : "none",
        }}
        transition={{ duration: 0.5 }}
      >
        {/* Scan line effect during encryption */}
        <AnimatePresence>
          {stage === "encrypting" && (
            <motion.div
              className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-cipher-400 to-transparent"
              initial={{ top: 0, opacity: 0 }}
              animate={{ top: "100%", opacity: [0, 1, 1, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          )}
        </AnimatePresence>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <span className="text-void-400 text-sm">Your bet</span>
          <motion.span
            className={`text-xs font-mono px-2 py-1 rounded ${
              stage === "encrypted"
                ? "bg-cipher-600/30 text-cipher-400"
                : stage === "encrypting"
                ? "bg-flux-600/30 text-flux-400"
                : "bg-void-700 text-void-400"
            }`}
            layout
          >
            {stage === "plain" && "VISIBLE"}
            {stage === "encrypting" && "ENCRYPTING..."}
            {stage === "encrypted" && "SEALED"}
          </motion.span>
        </div>

        {/* Main display */}
        <div className="text-center py-8">
          <motion.div
            className={`text-4xl sm:text-5xl font-mono font-bold tracking-tight ${
              stage === "encrypted"
                ? "text-cipher-400"
                : stage === "encrypting"
                ? "text-flux-400"
                : "text-white"
            }`}
            style={{
              textShadow:
                stage === "encrypted"
                  ? "0 0 30px rgba(124, 58, 237, 0.5)"
                  : "none",
            }}
          >
            {displayText}
          </motion.div>
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-center gap-2 text-xs text-void-500">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <span>
            {stage === "encrypted"
              ? "Position hidden from all observers"
              : "Bet visible to network"}
          </span>
        </div>
      </motion.div>

      {/* Decorative elements */}
      <div className="absolute -inset-4 -z-10">
        <div className="absolute top-1/2 left-0 w-20 h-px bg-gradient-to-r from-cipher-600/50 to-transparent" />
        <div className="absolute top-1/2 right-0 w-20 h-px bg-gradient-to-l from-cipher-600/50 to-transparent" />
      </div>
    </div>
  );
};
