import { DashboardNav } from "@/components/dashboard/nav";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <DashboardNav
        email={user.email}
        name={user.name}
        role={user.role}
        avatarUrl={user.avatar_url}
      />
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-8 outline-none sm:px-6 lg:py-10"
      >
        {children}
      </main>
      <footer className="mx-auto w-full max-w-[1180px] px-4 pb-8 pt-6 sm:px-6">
        <div className="border-t border-border pt-4 text-[11px] text-muted-foreground">
          Poetry Shorts · Rendering by Poetry Shorts Maker · Publishing by Buffer
        </div>
      </footer>
    </div>
  );
}
