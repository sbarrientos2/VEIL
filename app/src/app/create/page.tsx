"use client";

import { FC, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@solana/wallet-adapter-react";
import { useCreateMarket } from "@/hooks/useVeil";
import BN from "bn.js";

const categories = [
  { id: "crypto", label: "Crypto", icon: "₿" },
  { id: "finance", label: "Finance", icon: "📈" },
  { id: "technology", label: "Technology", icon: "💻" },
  { id: "politics", label: "Politics", icon: "🏛️" },
  { id: "science", label: "Science", icon: "🔬" },
  { id: "sports", label: "Sports", icon: "⚽" },
  { id: "entertainment", label: "Entertainment", icon: "🎬" },
  { id: "other", label: "Other", icon: "📌" },
];

interface FormData {
  question: string;
  description: string;
  category: string;
  endDate: string;
  endTime: string;
  minBet: string;
  maxBet: string;
  oracleAddress: string;
}

export default function CreateMarketPage() {
  const router = useRouter();
  const { connected, publicKey } = useWallet();
  const [step, setStep] = useState(1);
  const [createError, setCreateError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    question: "",
    description: "",
    category: "",
    endDate: "",
    endTime: "23:59",
    minBet: "10",
    maxBet: "10000",
    oracleAddress: "",
  });
  const [errors, setErrors] = useState<Partial<FormData>>({});

  const updateField = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateStep1 = () => {
    const newErrors: Partial<FormData> = {};

    if (!formData.question.trim()) {
      newErrors.question = "Question is required";
    } else if (formData.question.length < 20) {
      newErrors.question = "Question must be at least 20 characters";
    } else if (!formData.question.endsWith("?")) {
      newErrors.question = "Question must end with a question mark";
    }

    if (!formData.description.trim()) {
      newErrors.description = "Description is required";
    } else if (formData.description.length < 50) {
      newErrors.description = "Description must be at least 50 characters";
    }

    if (!formData.category) {
      newErrors.category = "Please select a category";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors: Partial<FormData> = {};

    if (!formData.endDate) {
      newErrors.endDate = "End date is required";
    } else {
      const endDateTime = new Date(`${formData.endDate}T${formData.endTime}`);
      const now = new Date();
      const minEndDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

      if (endDateTime < minEndDate) {
        newErrors.endDate = "End date must be at least 24 hours from now";
      }
    }

    const minBet = parseFloat(formData.minBet);
    const maxBet = parseFloat(formData.maxBet);

    if (isNaN(minBet) || minBet < 1) {
      newErrors.minBet = "Minimum bet must be at least $1";
    }

    if (isNaN(maxBet) || maxBet < 100) {
      newErrors.maxBet = "Maximum bet must be at least $100";
    }

    if (minBet >= maxBet) {
      newErrors.maxBet = "Maximum bet must be greater than minimum bet";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep3 = () => {
    const newErrors: Partial<FormData> = {};

    if (!formData.oracleAddress.trim()) {
      newErrors.oracleAddress = "Oracle address is required";
    } else if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(formData.oracleAddress)) {
      newErrors.oracleAddress = "Invalid Solana address format";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  // SDK hook for creating markets
  const { createMarket, isSubmitting, error: sdkError } = useCreateMarket();

  const handleSubmit = async () => {
    if (!validateStep3()) return;
    if (!connected) return;

    setCreateError(null);

    try {
      // Convert end date/time to Unix timestamp
      const endDateTime = new Date(`${formData.endDate}T${formData.endTime}`);
      const resolutionTime = Math.floor(endDateTime.getTime() / 1000);

      // Generate a unique market ID
      const marketId = new BN(Date.now());

      // Create the market using SDK
      const result = await createMarket({
        marketId,
        question: formData.question,
        resolutionTime,
        oracleType: "manual", // Default to manual oracle
        feeBps: 300, // 3% fee
      });

      if (result) {
        // Success - redirect to the new market
        router.push(`/markets/${result.marketPubkey}`);
      } else {
        setCreateError(sdkError?.message || "Failed to create market");
      }
    } catch (err) {
      console.error("Failed to create market:", err);
      setCreateError(err instanceof Error ? err.message : "Failed to create market");
    }
  };

  // Get minimum date (tomorrow)
  const getMinDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  };

  return (
    <div className="relative min-h-screen pt-24 pb-16">
      {/* Background */}
      <div className="absolute inset-0 grid-bg opacity-20" />
      <div className="absolute top-40 right-1/3 w-96 h-96 bg-cipher-600/10 rounded-full blur-[150px]" />

      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-display text-4xl sm:text-5xl font-bold text-white mb-4">
            Create{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cipher-400 to-flux-400">
              Market
            </span>
          </h1>
          <p className="text-lg text-void-400">
            Launch a new private prediction market on VEIL.
          </p>
        </motion.div>

        {/* Progress steps */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-12"
        >
          <div className="flex items-center justify-center gap-4">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-mono text-sm transition-all duration-300 ${
                    s < step
                      ? "bg-cipher-600 text-white"
                      : s === step
                      ? "bg-cipher-600/20 text-cipher-400 border-2 border-cipher-500"
                      : "bg-void-800 text-void-500"
                  }`}
                >
                  {s < step ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    s
                  )}
                </div>
                {s < 3 && (
                  <div
                    className={`w-16 sm:w-24 h-0.5 mx-2 transition-colors duration-300 ${
                      s < step ? "bg-cipher-600" : "bg-void-700"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-4 mt-4">
            <span className={`text-xs ${step >= 1 ? "text-void-300" : "text-void-600"}`}>
              Question
            </span>
            <span className={`text-xs ${step >= 2 ? "text-void-300" : "text-void-600"} ml-12 sm:ml-20`}>
              Settings
            </span>
            <span className={`text-xs ${step >= 3 ? "text-void-300" : "text-void-600"} ml-12 sm:ml-20`}>
              Oracle
            </span>
          </div>
        </motion.div>

        {/* Form card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card-glow p-8"
        >
          <AnimatePresence mode="wait">
            {/* Step 1: Question */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <label className="input-label">Market Question</label>
                  <textarea
                    value={formData.question}
                    onChange={(e) => updateField("question", e.target.value)}
                    placeholder="Will BTC reach $100,000 by January 31st, 2025?"
                    rows={2}
                    className={`input-field w-full resize-none ${
                      errors.question ? "border-breach-500" : ""
                    }`}
                  />
                  {errors.question && (
                    <p className="text-breach-400 text-xs mt-1">{errors.question}</p>
                  )}
                  <p className="text-void-500 text-xs mt-1">
                    Ask a clear yes/no question. Must end with "?"
                  </p>
                </div>

                <div>
                  <label className="input-label">Description & Resolution Criteria</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => updateField("description", e.target.value)}
                    placeholder="Describe exactly how this market will be resolved. Include specific criteria, data sources, and edge cases..."
                    rows={4}
                    className={`input-field w-full resize-none ${
                      errors.description ? "border-breach-500" : ""
                    }`}
                  />
                  {errors.description && (
                    <p className="text-breach-400 text-xs mt-1">{errors.description}</p>
                  )}
                  <p className="text-void-500 text-xs mt-1">
                    Be specific about resolution criteria to avoid disputes.
                  </p>
                </div>

                <div>
                  <label className="input-label">Category</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => updateField("category", cat.id)}
                        className={`p-3 rounded-xl border text-sm font-medium transition-all duration-200 ${
                          formData.category === cat.id
                            ? "bg-cipher-600/20 border-cipher-500 text-cipher-300"
                            : "bg-void-800/50 border-void-700/50 text-void-400 hover:border-void-600 hover:text-white"
                        }`}
                      >
                        <span className="text-lg block mb-1">{cat.icon}</span>
                        {cat.label}
                      </button>
                    ))}
                  </div>
                  {errors.category && (
                    <p className="text-breach-400 text-xs mt-2">{errors.category}</p>
                  )}
                </div>
              </motion.div>
            )}

            {/* Step 2: Settings */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <label className="input-label">Market End Date & Time</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <input
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => updateField("endDate", e.target.value)}
                        min={getMinDate()}
                        className={`input-field w-full ${
                          errors.endDate ? "border-breach-500" : ""
                        }`}
                      />
                    </div>
                    <div>
                      <input
                        type="time"
                        value={formData.endTime}
                        onChange={(e) => updateField("endTime", e.target.value)}
                        className="input-field w-full"
                      />
                    </div>
                  </div>
                  {errors.endDate && (
                    <p className="text-breach-400 text-xs mt-1">{errors.endDate}</p>
                  )}
                  <p className="text-void-500 text-xs mt-1">
                    Betting closes at this time. Must be at least 24 hours from now.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="input-label">Minimum Bet (USDC)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-void-500">
                        $
                      </span>
                      <input
                        type="number"
                        value={formData.minBet}
                        onChange={(e) => updateField("minBet", e.target.value)}
                        min="1"
                        className={`input-field pl-8 w-full ${
                          errors.minBet ? "border-breach-500" : ""
                        }`}
                      />
                    </div>
                    {errors.minBet && (
                      <p className="text-breach-400 text-xs mt-1">{errors.minBet}</p>
                    )}
                  </div>
                  <div>
                    <label className="input-label">Maximum Bet (USDC)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-void-500">
                        $
                      </span>
                      <input
                        type="number"
                        value={formData.maxBet}
                        onChange={(e) => updateField("maxBet", e.target.value)}
                        min="100"
                        className={`input-field pl-8 w-full ${
                          errors.maxBet ? "border-breach-500" : ""
                        }`}
                      />
                    </div>
                    {errors.maxBet && (
                      <p className="text-breach-400 text-xs mt-1">{errors.maxBet}</p>
                    )}
                  </div>
                </div>

                {/* Info box */}
                <div className="p-4 bg-cipher-900/20 rounded-xl border border-cipher-700/30">
                  <div className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-cipher-400 mt-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <div className="text-sm">
                      <p className="text-cipher-300">Parimutuel Betting Model</p>
                      <p className="text-void-500 text-xs mt-1">
                        All bets are pooled. Winners share the losing pool proportionally.
                        There are no odds—payouts depend on final pool distribution.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 3: Oracle */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <label className="input-label">Oracle Address</label>
                  <input
                    type="text"
                    value={formData.oracleAddress}
                    onChange={(e) => updateField("oracleAddress", e.target.value)}
                    placeholder="Enter a valid Solana address..."
                    className={`input-field w-full font-mono text-sm ${
                      errors.oracleAddress ? "border-breach-500" : ""
                    }`}
                  />
                  {errors.oracleAddress && (
                    <p className="text-breach-400 text-xs mt-1">{errors.oracleAddress}</p>
                  )}
                  <p className="text-void-500 text-xs mt-1">
                    The oracle is the trusted party that will resolve this market.
                  </p>
                </div>

                {/* Use self as oracle */}
                {connected && publicKey && (
                  <button
                    type="button"
                    onClick={() => updateField("oracleAddress", publicKey.toBase58())}
                    className="text-sm text-cipher-400 hover:text-cipher-300 transition-colors"
                  >
                    Use my wallet as oracle →
                  </button>
                )}

                {/* Warning box */}
                <div className="p-4 bg-flux-900/20 rounded-xl border border-flux-700/30">
                  <div className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-flux-400 mt-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <div className="text-sm">
                      <p className="text-flux-300">Oracle Responsibility</p>
                      <p className="text-void-500 text-xs mt-1">
                        The oracle must resolve the market honestly and on time.
                        Only designate trusted parties as oracles.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Summary */}
                <div className="p-6 bg-void-800/50 rounded-xl border border-void-700/50">
                  <h3 className="text-sm font-medium text-white mb-4">Market Summary</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-void-400">Question</span>
                      <span className="text-white text-right max-w-[60%] truncate">
                        {formData.question || "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-void-400">Category</span>
                      <span className="text-white capitalize">{formData.category || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-void-400">Ends</span>
                      <span className="text-white">
                        {formData.endDate
                          ? new Date(`${formData.endDate}T${formData.endTime}`).toLocaleString()
                          : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-void-400">Bet Range</span>
                      <span className="text-white font-mono">
                        ${formData.minBet} — ${formData.maxBet}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t border-void-700/50">
            <button
              type="button"
              onClick={handleBack}
              disabled={step === 1}
              className="btn-secondary disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ← Back
            </button>

            {step < 3 ? (
              <button type="button" onClick={handleNext} className="btn-primary">
                Continue →
              </button>
            ) : !connected ? (
              <button className="btn-primary">Connect Wallet</button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="btn-primary min-w-[140px]"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="animate-spin w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Creating...
                  </span>
                ) : (
                  "Create Market"
                )}
              </button>
            )}
          </div>
        </motion.div>

        {/* Help text */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center text-void-500 text-sm mt-8"
        >
          Need help?{" "}
          <a
            href="https://docs.arcium.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cipher-400 hover:text-cipher-300 transition-colors"
          >
            Read the documentation
          </a>
        </motion.p>
      </div>
    </div>
  );
}
