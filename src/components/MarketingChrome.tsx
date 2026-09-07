import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import logoUrl from "@/assets/makao360-logo.png";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2">
          <img src={logoUrl} alt="Makao360" className="h-9 w-auto" />
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          <NavLink to="/product">Product</NavLink>
          <NavLink to="/landlords">For Landlords</NavLink>
          <NavLink to="/mobile-preview">Mobile App</NavLink>
          <NavLink to="/vacancies">Vacancies</NavLink>
        </nav>
        <Link
          to="/login"
          search={{ invite: undefined, redirect: undefined }}
          className="group inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:bg-graphite"
        >
          Open app
          <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </Link>
      </div>
    </header>
  );
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="rounded-full px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      activeProps={{ className: "rounded-full px-4 py-2 text-sm bg-secondary text-foreground" }}
    >
      {children}
    </Link>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <img src={logoUrl} alt="Makao360" className="h-10 w-auto" />
            <p className="mt-4 max-w-sm font-display text-2xl leading-tight tracking-tight text-foreground text-balance">
              Flexible rent. Better records. Less stress.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">Powered by M-Pesa.</p>
          </div>
          <FooterCol title="Product" links={[
            ["Overview", "/product"],
            ["For Landlords", "/landlords"],
            ["Mobile App", "/mobile-preview"],
          ]} />
          <FooterCol title="Get started" links={[
            ["Sign up", "/signup"],
            ["Sign in", "/login"],
          ]} />
          <FooterCol title="Trust" links={[
            ["Security", "/security"],
            ["Help Center", "/help"],
          ]} />
          <FooterCol title="Legal" links={[
            ["Terms", "/legal/terms"],
            ["Privacy", "/legal/privacy"],
            ["Cookies", "/legal/cookies"],
          ]} />
        </div>
        <div className="mt-16 flex flex-col items-start justify-between gap-4 border-t border-border pt-8 text-xs text-muted-foreground md:flex-row md:items-center">
          <span>© {new Date().getFullYear()} Makao360. Nairobi, Kenya.</span>
          <div className="flex items-center gap-4">
            <LocaleSwitcher />
            <span className="font-mono">v3.1 · M-Pesa native</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: ReadonlyArray<readonly [string, string]> }) {
  return (
    <div className="md:col-span-2">
      <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{title}</h4>
      <ul className="mt-4 space-y-2.5 text-sm">
        {links.map(([label, to]) => (
          <li key={label}>
            <Link to={to} className="text-foreground transition-colors hover:text-clay">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
