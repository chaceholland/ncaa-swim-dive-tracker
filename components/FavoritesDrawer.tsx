"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { isExternalUrl } from "@/lib/image-utils";
import type { AthleteFavorite, TeamFavorite } from "@/lib/hooks/useFavorites";

export interface FavoritesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  athletes: AthleteFavorite[];
  teams: TeamFavorite[];
  onRemoveAthlete: (id: string) => void;
  onRemoveTeam: (id: string) => void;
}

type Tab = "athletes" | "teams";

export default function FavoritesDrawer({
  isOpen,
  onClose,
  athletes,
  teams,
  onRemoveAthlete,
  onRemoveTeam,
}: FavoritesDrawerProps) {
  const [activeTab, setActiveTab] = useState<Tab>("athletes");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!mounted || typeof window === "undefined") {
    return null;
  }

  const drawerContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer panel */}
          <motion.div
            key="drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed top-0 right-0 h-full w-full sm:w-[400px] bg-white shadow-2xl z-50 flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label="Favorites"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white flex-shrink-0">
              <h2 className="text-xl font-bold text-slate-900">Favorites</h2>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                aria-label="Close favorites"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 flex-shrink-0">
              <button
                onClick={() => setActiveTab("athletes")}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === "athletes"
                    ? "text-primary border-b-2 border-primary bg-primary/5"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }`}
              >
                Athletes ({athletes.length})
              </button>
              <button
                onClick={() => setActiveTab("teams")}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === "teams"
                    ? "text-primary border-b-2 border-primary bg-primary/5"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }`}
              >
                Teams ({teams.length})
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === "athletes" && (
                <div className="p-4">
                  {athletes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                      <svg
                        className="w-16 h-16 mb-4 text-slate-200"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                        />
                      </svg>
                      <p className="text-slate-500 font-medium">
                        No favorite athletes yet
                      </p>
                      <p className="text-slate-400 text-sm mt-1">
                        Browse athlete profiles and tap the heart icon to save
                        favorites.
                      </p>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {athletes.map((athlete) => (
                        <li
                          key={athlete.id}
                          className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group"
                        >
                          {/* Photo */}
                          <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-200 flex-shrink-0">
                            {athlete.photo_url ? (
                              isExternalUrl(athlete.photo_url) ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={athlete.photo_url}
                                  alt={athlete.name}
                                  referrerPolicy="no-referrer"
                                  loading="lazy"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Image
                                  src={athlete.photo_url}
                                  alt={athlete.name}
                                  width={48}
                                  height={48}
                                  className="object-cover"
                                />
                              )
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <span className="text-slate-500 text-sm font-semibold">
                                  {athlete.name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                    .slice(0, 2)}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <Link
                            href={`/athlete/${athlete.id}`}
                            onClick={onClose}
                            className="flex-1 min-w-0"
                          >
                            <p className="font-medium text-slate-900 truncate group-hover:text-primary transition-colors">
                              {athlete.name}
                            </p>
                            <p className="text-xs text-slate-500 capitalize truncate">
                              {[athlete.class_year, athlete.athlete_type]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </Link>

                          {/* Remove button */}
                          <button
                            onClick={() => onRemoveAthlete(athlete.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                            aria-label={`Remove ${athlete.name} from favorites`}
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {activeTab === "teams" && (
                <div className="p-4">
                  {teams.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                      <svg
                        className="w-16 h-16 mb-4 text-slate-200"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      <p className="text-slate-500 font-medium">
                        No favorite teams yet
                      </p>
                      <p className="text-slate-400 text-sm mt-1">
                        Browse team pages and tap the heart icon to save
                        favorites.
                      </p>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {teams.map((team) => (
                        <li
                          key={team.id}
                          className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group"
                        >
                          {/* Logo */}
                          <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-200 flex-shrink-0">
                            {team.logo_url ? (
                              isExternalUrl(team.logo_url) ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={team.logo_url}
                                  alt={team.name}
                                  referrerPolicy="no-referrer"
                                  loading="lazy"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Image
                                  src={team.logo_url}
                                  alt={team.name}
                                  width={48}
                                  height={48}
                                  className="object-cover"
                                />
                              )
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <span className="text-slate-500 text-sm font-semibold">
                                  {team.name.charAt(0)}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <Link
                            href={`/team/${team.id}`}
                            onClick={onClose}
                            className="flex-1 min-w-0"
                          >
                            <p className="font-medium text-slate-900 truncate group-hover:text-primary transition-colors">
                              {team.name}
                            </p>
                            {team.conference && (
                              <p className="text-xs text-slate-500 truncate">
                                {team.conference}
                              </p>
                            )}
                          </Link>

                          {/* Remove button */}
                          <button
                            onClick={() => onRemoveTeam(team.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                            aria-label={`Remove ${team.name} from favorites`}
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(drawerContent, document.body);
}
