import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-surface flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="font-mono text-8xl font-bold text-brand-400 mb-4">404</div>
          <h1 className="text-2xl font-bold text-ink mb-3">Page not found</h1>
          <p className="text-ink-2 text-sm mb-8">
            The page you&apos;re looking for doesn&apos;t exist. Maybe you followed a broken link,
            or the room code expired.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/practice"    className="btn-ghost px-5 py-2.5">Practice</Link>
            <Link href="/multiplayer" className="btn-primary px-5 py-2.5">Find a race →</Link>
          </div>
        </div>
      </main>
    </>
  );
}
