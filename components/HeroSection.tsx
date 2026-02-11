'use client';

import { motion, useAnimation } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useInView } from 'react-intersection-observer';

interface StatCardProps {
  value: number;
  label: string;
  highlight?: boolean;
}

const StatCard = ({ value, label, highlight = false }: StatCardProps) => {
  const [count, setCount] = useState(0);
  const [ref, inView] = useInView({
    threshold: 0.3,
    triggerOnce: true,
  });

  useEffect(() => {
    if (inView) {
      let startTime: number;
      const duration = 2000; // 2 seconds animation

      const animate = (currentTime: number) => {
        if (!startTime) startTime = currentTime;
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function for smooth animation
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        setCount(Math.floor(easeOutQuart * value));

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setCount(value);
        }
      };

      requestAnimationFrame(animate);
    }
  }, [inView, value]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className={`
        relative overflow-hidden rounded-2xl p-8 backdrop-blur-sm
        ${
          highlight
            ? 'bg-orange-500/20 border-2 border-orange-500/50'
            : 'bg-white/10 border-2 border-white/20'
        }
        hover:scale-105 transition-transform duration-300
      `}
    >
      <div className="relative z-10">
        <div
          className={`
            text-5xl md:text-6xl font-bold mb-2
            ${highlight ? 'text-orange-300' : 'text-brand-cyan'}
          `}
        >
          {count.toLocaleString()}
        </div>
        <div className="text-white/90 text-lg md:text-xl font-medium">
          {label}
        </div>
      </div>

      {/* Glow effect */}
      <div
        className={`
          absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-500
          ${
            highlight
              ? 'bg-gradient-to-br from-orange-500/20 to-orange-600/20'
              : 'bg-gradient-to-br from-brand-cyan/20 to-blue-500/20'
          }
        `}
      />
    </motion.div>
  );
};

export default function HeroSection() {
  const controls = useAnimation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Start gradient animation
    controls.start({
      backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
      transition: {
        duration: 8,
        ease: 'linear',
        repeat: Infinity,
      },
    });
  }, [controls]);

  if (!mounted) {
    return null; // Prevent SSR mismatch
  }

  return (
    <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
      {/* Animated gradient background */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-[#0A1628] via-[#1E3A5F] to-[#0A1628]"
        animate={controls}
        style={{
          backgroundSize: '200% 200%',
        }}
      />

      {/* Wave pattern overlay */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: 'url(/wave-pattern.svg)',
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      {/* Content container */}
      <div className="relative z-10 container mx-auto px-6 py-20">
        <div className="max-w-7xl mx-auto">
          {/* Main headline */}
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="text-center mb-8"
          >
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6">
              <span className="bg-gradient-to-r from-brand-cyan via-blue-400 to-brand-cyan bg-clip-text text-transparent animate-gradient">
                NCAA D1 Swimming
              </span>
              <br />
              <span className="text-white">& Diving Tracker</span>
            </h1>

            {/* Subheading */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="text-xl md:text-2xl text-white/80 max-w-3xl mx-auto"
            >
              Track every team and athlete across Division I men's
              swimming and diving
            </motion.p>
          </motion.div>

          {/* Stats cards */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-12"
          >
            <StatCard value={53} label="D1 Men's Teams" />
            <StatCard value={1628} label="Athletes" />
            <StatCard value={45} label="Teams with Data" highlight />
          </motion.div>

          {/* Last updated timestamp */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.8 }}
            className="text-center text-white/60 text-sm"
          >
            Last updated: {new Date().toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.8 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{
            y: [0, 10, 0],
          }}
          transition={{
            duration: 1.5,
            ease: 'easeInOut',
            repeat: Infinity,
          }}
          className="flex flex-col items-center gap-2"
        >
          <span className="text-white/60 text-sm font-medium">Scroll</span>
          <svg
            className="w-6 h-6 text-brand-cyan"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </motion.div>
      </motion.div>
    </section>
  );
}
