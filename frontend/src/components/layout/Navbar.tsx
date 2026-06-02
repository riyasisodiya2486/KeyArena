
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut, signIn } from "next-auth/react";
import { useState } from "react";
import { clsx } from "clsx";

const NAV_LINKS = [
  { href: "/practice",    label: "Practice"    },
  { href: "/multiplayer", label: "Multiplayer" },
  { href: "/compete",     label: "Compete"     },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/stats",       label: "My Stats"    },
];

export function Navbar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-neutral-800 bg-[#0E0E0F]/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          
          {/* Logo Section */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <span className="font-mono text-xl font-bold tracking-wider text-[#F2F1EE]">
                Key<span className="text-[#E8593C]">Arena</span>
              </span>
            </Link>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center gap-1">
              {NAV_LINKS.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={clsx(
                      "relative px-4 py-2 font-sans text-sm font-medium transition-colors duration-200 rounded-md",
                      isActive
                        ? "text-[#E8593C] bg-[#E8593C]/10"
                        : "text-[#A8A7A3] hover:text-[#F2F1EE] hover:bg-neutral-800/50"
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Auth & Profile Section */}
          <div className="flex items-center gap-4">
            {status === "loading" ? (
              <div className="h-8 w-8 animate-pulse rounded-full bg-neutral-800" />
            ) : session?.user ? (
              /* User is Signed In Dropdown Container */
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
                  className="flex items-center gap-2 rounded-full p-1 border border-neutral-800 hover:border-neutral-700 focus:outline-none transition-all"
                >
                  {session.user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={session.user.image}
                      alt="Avatar"
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E8593C]/20 text-xs font-bold text-[#E8593C]">
                      {session.user.name?.[0]?.toUpperCase() || "U"}
                    </div>
                  )}
                </button>

                {/* Dropdown Menu Window */}
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-xl border border-neutral-800 bg-[#161618] py-2 shadow-xl animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-4 py-2 border-b border-neutral-800/50">
                      <p className="text-xs text-[#A8A7A3]">Signed in as</p>
                      <p className="truncate text-sm font-medium text-[#F2F1EE]">
                        {session.user.username || session.user.name || "Racer"}
                      </p>
                    </div>
                    
                    <Link
                      href="/stats"
                      className="flex w-full px-4 py-2 text-sm text-[#A8A7A3] hover:bg-neutral-800 hover:text-[#F2F1EE] transition-colors"
                    >
                      Dashboard Profile
                    </Link>
                    
                    <button
                      onClick={() => signOut()}
                      className="flex w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-neutral-800/50 transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* User Is Logged Out Button Fallback */
              <button
                onClick={() => signIn()}
                className="rounded-lg bg-[#E8593C] px-4 py-2 text-sm font-semibold text-[#F2F1EE] hover:bg-[#C43D22] transition-colors shadow-md shadow-[#E8593C]/10"
              >
                Sign In
              </button>
            )}
          </div>

        </div>
      </div>
    </nav>
  );
}