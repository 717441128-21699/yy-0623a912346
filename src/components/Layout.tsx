import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, BookOpen, Users, ChevronDown } from "lucide-react";
import { useStore } from "@/store/useStore";
import type { Member } from "@/types";
import { ROLE_LABELS } from "@/types";

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const projects = useStore((s) => s.projects);
  const members = useStore((s) => s.members);
  const currentUserId = useStore((s) => s.currentUserId);
  const setCurrentUser = useStore((s) => s.setCurrentUser);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const currentUser = members.find((m: Member) => m.id === currentUserId);

  const navLinks = [
    { to: "/", label: "看板首页", icon: LayoutDashboard },
    ...projects.map((p: { id: string; name: string }) => ({
      to: `/project/${p.id}`,
      label: p.name,
      icon: BookOpen,
    })),
    { to: "/members", label: "成员统计", icon: Users },
  ];

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex min-h-screen bg-dark-primary text-txt-primary">
      <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col bg-dark-secondary border-r border-border-dark">
        <div className="flex items-center justify-center h-16 border-b border-border-dark">
          <h1 className="text-2xl font-display text-accent-red">汉化看板</h1>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.to);
              return (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                      active
                        ? "bg-accent-red/20 text-accent-red"
                        : "text-txt-secondary hover:bg-dark-card hover:text-txt-primary"
                    }`}
                  >
                    <Icon size={18} />
                    <span className="truncate">{link.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-border-dark p-3">
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex w-full items-center gap-2 rounded-lg bg-dark-card px-3 py-2 text-sm text-txt-primary hover:bg-accent-blue/40 transition-colors"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-red text-xs font-bold text-white">
                {currentUser?.name?.charAt(0) ?? "?"}
              </div>
              <div className="flex-1 text-left">
                <div className="truncate">{currentUser?.name ?? "未选择"}</div>
                {currentUser && (
                  <div className="text-xs text-txt-muted">
                    {ROLE_LABELS[currentUser.role]}
                  </div>
                )}
              </div>
              <ChevronDown
                size={16}
                className={`text-txt-muted transition-transform ${
                  userMenuOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {userMenuOpen && (
              <ul className="absolute bottom-full left-0 mb-1 w-full rounded-lg bg-dark-card border border-border-dark shadow-lg overflow-hidden z-50">
                {members.map((m: Member) => (
                  <li key={m.id}>
                    <button
                      onClick={() => {
                        setCurrentUser(m.id);
                        setUserMenuOpen(false);
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors ${
                        m.id === currentUserId
                          ? "bg-accent-red/20 text-accent-red"
                          : "text-txt-secondary hover:bg-accent-blue/30 hover:text-txt-primary"
                      }`}
                    >
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-blue text-xs font-bold text-white">
                        {m.name.charAt(0)}
                      </div>
                      <div className="flex-1 text-left truncate">{m.name}</div>
                      <span className="text-xs text-txt-muted">
                        {ROLE_LABELS[m.role]}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </aside>

      <main className="ml-60 flex-1 p-6">{children}</main>
    </div>
  );
}
