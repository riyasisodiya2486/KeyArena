
"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession, signOut, signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { Menu, X } from "lucide-react";

const NAV_LINKS = [
  { href: "/practice",    label: "Practice"    },
  { href: "/multiplayer", label: "Multiplayer" },
  { href: "/compete",     label: "Compete"     },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/stats",       label: "My Stats"    },
  { href: "/insights",    label: "Insights" },
];

export function Navbar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") {
      setIsAdmin(false);
      return;
    }

    const controller = new AbortController();
    fetch("/api/admin/status", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() : { isAdmin: false })
      .then((data: { isAdmin?: boolean }) => setIsAdmin(Boolean(data.isAdmin)))
      .catch(() => setIsAdmin(false));
    return () => controller.abort();
  }, [status, session?.user?.id]);

  const visibleLinks = isAdmin
    ? [...NAV_LINKS, { href: "/admin/competitions", label: "Admin" }]
    : NAV_LINKS;

  return (
    <nav className="ka-site-navbar sticky top-0 z-50 w-full border-b border-white/10 bg-[#101012]/95 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          
          {/* Logo Section */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 group">
              <Image
                src="/logo.png?v=2"
                alt="KeyArena logo"
                width={32}
                height={32}
                unoptimized
                className="rounded-md transition-transform group-hover:scale-105"
              />
              <span className="text-xl font-bold tracking-[-.06em] text-[#F2EEE6] transition-colors group-hover:text-[#E45B46]">
                KeyArena
              </span>
            </Link>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center gap-1">
              {visibleLinks.map((link) => {
                const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={clsx(
                      "relative px-4 py-2 rounded-lg font-sans text-sm font-medium transition-all duration-200",
                      isActive
                        ? "text-[#E45B46] bg-[#E45B46]/10"
                        : "text-[#AAA69D] hover:text-[#F2EEE6] hover:bg-white/5"
                    )}
                  >
                    {link.label}
                    {isActive && (
                      <span className="absolute inset-x-3 -bottom-[9px] h-0.5 rounded-full bg-[#E45B46]" />
                    )}
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
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E45B46]/20 text-xs font-bold text-[#E45B46]">
                      {session.user.name?.[0]?.toUpperCase() || "U"}
                    </div>
                  )}
                </button>

                {/* Dropdown Menu Window */}
                {dropdownOpen && (
                    <div className="absolute right-0 mt-2 w-48 border border-white/15 bg-[#19191C] py-2 shadow-xl animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-4 py-2 border-b border-neutral-800/50">
                      <p className="text-xs text-[#AAA69D]">Signed in as</p>
                      <p className="truncate text-sm font-medium text-[#F2EEE6]">
                        {session.user.username || session.user.name || "Racer"}
                      </p>
                    </div>
                    
                    <Link
                      href="/stats"
                      className="flex w-full px-4 py-2 text-sm text-[#AAA69D] hover:bg-white/5 hover:text-[#F2EEE6] transition-colors"
                    >
                      Dashboard Profile
                    </Link>

                    {isAdmin && (
                      <Link
                        href="/admin/competitions"
                        className="flex w-full px-4 py-2 text-sm text-[#AAA69D] hover:bg-white/5 hover:text-[#F2EEE6] transition-colors"
                      >
                        Admin controls
                      </Link>
                    )}
                    
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
                className="border border-[#E45B46] bg-[#E45B46] px-4 py-2 text-xs font-semibold text-white hover:bg-[#C94B39] transition-colors"
              >
                Sign In
              </button>
            )}
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close navigation" : "Open navigation"}
              onClick={() => setMenuOpen((open) => !open)}
              className="md:hidden border border-white/20 px-3 py-2 font-mono text-[10px] tracking-wider text-[#F2EEE6]"
            >
              {menuOpen ? <X size={17} /> : <Menu size={17} />}
            </button>
          </div>

        </div>
      </div>
      {menuOpen && (
        <div className="border-t border-white/10 bg-[#101012] px-5 py-3 md:hidden">
          {visibleLinks.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)}
              className={clsx("block border-b border-white/10 py-3 text-sm last:border-0", pathname === link.href ? "text-[#E45B46]" : "text-[#D5D1C8]")}
            >{link.label}</Link>
          ))}
        </div>
      )}
    </nav>
  );
}
