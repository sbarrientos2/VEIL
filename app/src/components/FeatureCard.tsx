"use client";

import { FC, ReactNode } from "react";
import { motion } from "framer-motion";

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  variant: "problem" | "solution";
  delay?: number;
}

export const FeatureCard: FC<FeatureCardProps> = ({
  icon,
  title,
  description,
  variant,
  delay = 0,
}) => {
  const isProblem = variant === "problem";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -4 }}
      className={`relative p-6 rounded-2xl border transition-all duration-300 ${
        isProblem
          ? "bg-void-800/30 border-void-700/50 hover:border-breach-600/50"
          : "bg-void-800/50 border-void-600/50 hover:border-cipher-600/50 hover:shadow-cipher"
      }`}
    >
      {/* Icon */}
      <div
        className={`inline-flex items-center justify-center w-14 h-14 rounded-xl mb-4 ${
          isProblem
            ? "bg-breach-600/10 text-breach-400"
            : "bg-cipher-600/10 text-cipher-400"
        }`}
      >
        {icon}
      </div>

      {/* Content */}
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-void-400 leading-relaxed">{description}</p>

      {/* Decorative corner */}
      <div
        className={`absolute top-0 right-0 w-16 h-16 rounded-bl-3xl rounded-tr-2xl opacity-5 ${
          isProblem ? "bg-breach-500" : "bg-cipher-500"
        }`}
      />
    </motion.div>
  );
};
