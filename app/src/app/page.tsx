"use client";

import { FC } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { EncryptionAnimation } from "@/components/EncryptionAnimation";
import { FeatureCard } from "@/components/FeatureCard";
import { HowItWorks } from "@/components/HowItWorks";

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
};

const stagger = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export default function HomePage() {
  return (
    <div className="relative">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        {/* Background elements */}
        <div className="absolute inset-0 grid-bg opacity-50" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cipher-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-flux-500/10 rounded-full blur-[100px]" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <motion.div
            className="text-center"
            initial="initial"
            animate="animate"
            variants={stagger}
          >
            {/* Badge */}
            <motion.div variants={fadeInUp} className="mb-8">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cipher-900/50 border border-cipher-700/50 text-cipher-400 text-sm font-mono">
                <span className="w-2 h-2 rounded-full bg-cipher-400 animate-pulse" />
                Powered by Arcium MPC
              </span>
            </motion.div>

            {/* Main headline */}
            <motion.h1
              variants={fadeInUp}
              className="text-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-white mb-6"
            >
              Bet in
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-cipher-400 via-cipher-300 to-flux-400">
                Silence
              </span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              variants={fadeInUp}
              className="text-xl sm:text-2xl text-void-300 max-w-2xl mx-auto mb-8"
            >
              Private prediction markets where your position stays{" "}
              <span className="text-encrypted">encrypted</span> until resolution.
              No whales watching. No herding. Just pure conviction.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              variants={fadeInUp}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
            >
              <Link href="/markets" className="btn-primary text-lg px-8 py-4">
                Browse Markets
              </Link>
              <Link href="/create" className="btn-secondary text-lg px-8 py-4">
                Create Market
              </Link>
            </motion.div>

            {/* Encryption animation preview */}
            <motion.div
              variants={fadeInUp}
              className="max-w-xl mx-auto"
            >
              <EncryptionAnimation />
            </motion.div>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
        >
          <div className="flex flex-col items-center gap-2 text-void-500">
            <span className="text-xs uppercase tracking-wider">Scroll</span>
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* Problem/Solution Section */}
      <section className="relative py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-void-900/50 to-transparent" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-20"
          >
            <h2 className="text-display text-4xl sm:text-5xl font-bold text-white mb-6">
              Traditional markets are{" "}
              <span className="text-breach-400">broken</span>
            </h2>
            <p className="text-xl text-void-400 max-w-2xl mx-auto">
              Public betting creates perverse incentives that corrupt market efficiency.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard
              icon={
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              }
              title="Whale Watching"
              description="Large bets move markets visibly, letting others copy or front-run."
              variant="problem"
              delay={0}
            />
            <FeatureCard
              icon={
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              }
              title="Herding"
              description="Users follow 'smart money' instead of their own analysis."
              variant="problem"
              delay={0.1}
            />
            <FeatureCard
              icon={
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              }
              title="Front-Running"
              description="Bots exploit visible pending transactions for profit."
              variant="problem"
              delay={0.2}
            />
            <FeatureCard
              icon={
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              }
              title="Doxxing Risk"
              description="High-profile bettors face harassment and social pressure."
              variant="problem"
              delay={0.3}
            />
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="relative py-32 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-cipher-600/10 rounded-full blur-[150px]" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-20"
          >
            <h2 className="text-display text-4xl sm:text-5xl font-bold text-white mb-6">
              VEIL fixes this with{" "}
              <span className="text-cipher-400">encryption</span>
            </h2>
            <p className="text-xl text-void-400 max-w-2xl mx-auto">
              Sealed envelope betting powered by multi-party computation.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard
              icon={
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              }
              title="Encrypted Bets"
              description="Your position and amount are encrypted client-side before submission."
              variant="solution"
              delay={0}
            />
            <FeatureCard
              icon={
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              }
              title="MPC Aggregation"
              description="Arcium nodes aggregate bets without ever seeing individual values."
              variant="solution"
              delay={0.1}
            />
            <FeatureCard
              icon={
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              }
              title="Reveal at Resolution"
              description="Only pool totals are revealed. Individual bets stay private forever."
              variant="solution"
              delay={0.2}
            />
            <FeatureCard
              icon={
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              title="Fair Payouts"
              description="Parimutuel model: winners share the losing pool proportionally."
              variant="solution"
              delay={0.3}
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <HowItWorks />

      {/* CTA Section */}
      <section className="relative py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-cipher-950/50 to-transparent" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-display text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6">
              Ready to bet with{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cipher-400 to-flux-400">
                conviction?
              </span>
            </h2>
            <p className="text-xl text-void-400 mb-10 max-w-2xl mx-auto">
              Join the first truly private prediction market. Your knowledge is your edge—keep it hidden.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/markets"
                className="btn-primary text-lg px-10 py-4 min-w-[200px]"
              >
                Start Trading
              </Link>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost text-lg"
              >
                View on GitHub →
              </a>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
