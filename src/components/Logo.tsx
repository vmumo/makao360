import { Link } from "@tanstack/react-router";
import logoUrl from "@/assets/makao360-logo.png";

export function Logo({
  className = "",
  to = "/",
  variant = "wordmark",
  size = 36,
}: {
  className?: string;
  to?: string;
  variant?: "wordmark" | "icon" | "image";
  size?: number;
}) {
  if (variant === "image") {
    return (
      <Link to={to} className={`inline-flex items-center ${className}`}>
        <img
          src={logoUrl}
          alt="Makao360"
          style={{ height: size }}
          className="w-auto"
        />
      </Link>
    );
  }

  if (variant === "icon") {
    return (
      <Link to={to} className={`inline-flex items-center ${className}`}>
        <img
          src={logoUrl}
          alt="Makao360"
          style={{ height: size, width: size, objectFit: "contain", objectPosition: "top" }}
        />
      </Link>
    );
  }

  // wordmark — text version using brand colors
  return (
    <Link to={to} className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className="grid place-items-center size-9 rounded-xl bg-primary text-primary-foreground font-display font-bold text-lg shadow-card"
        aria-hidden
      >
        M
      </span>
      <span className="font-display font-bold text-lg tracking-tight text-primary">
        Makao<span className="text-accent">360</span>
      </span>
    </Link>
  );
}
