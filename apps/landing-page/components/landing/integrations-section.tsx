"use client";

import { useEffect, useRef, useState } from "react";

const integrations = [
  {
    name: "GitHub",
    description:
      "Pull requests, issues, commits, discussions, releases, and code",
    icon: "github",
  },
  {
    name: "Google Docs",
    description: "Documentation, RFCs, meeting notes, and design docs",
    icon: "docs",
  },
  {
    name: "Slack",
    description: "Real-time streaming, threads, mentions, and agent home",
    icon: "slack",
  },
];

function IntegrationIcon({ type }: { type: string }) {
  if (type === "github") {
    return (
      <svg viewBox="0 0 24 24" className="w-12 h-12">
        <path
          fill="currentColor"
          d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-4.663-.453-1.005-1.783-1.005-1.005-1.783 0-.451.152-.839.418-1.237-1.616-.161-3.439.152-4.669 1.237-4.669 0 0 .352.171.762.451 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107.775.418 1.305.762 1.604 4.663.453 1.005 1.783 1.005 1.783 0 .451-.152.839-.418 1.237 1.616.161 3.439-.152 4.669-1.237 4.669 0 0-.352-.171-.762-.451-1.839-1.237-1.07-1.834-2.807-1.304-3.492.997-.107.775-.418 1.305-.762 1.604-4.663.453-1.005-1.783-1.005-1.783 0 0 .152.839.418 1.237-1.616.161-3.439.152-4.669-1.237-4.669 0 0-.352.171-.762.451z"
        />
      </svg>
    );
  }

  if (type === "docs") {
    return (
      <svg viewBox="0 0 24 24" className="w-12 h-12">
        <path
          fill="currentColor"
          d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"
        />
        <path fill="currentColor" d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
      </svg>
    );
  }

  if (type === "slack") {
    return (
      <svg viewBox="0 0 24 24" className="w-12 h-12">
        <path
          fill="currentColor"
          d="M6 10V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4M6 14v4a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-4M8 12h8M12 8v8"
        />
      </svg>
    );
  }

  return null;
}

export function IntegrationsSection() {
  const [isVisible, setIsVisible] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setIsMounted(true);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 },
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="integrations"
      ref={sectionRef}
      className="relative py-24 lg:py-32"
    >
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        {/* Header */}
        <div className="mb-16 lg:mb-24">
          <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
            <span className="w-8 h-px bg-foreground/30" />
            Integrations
          </span>
          <h2
            className={`text-4xl lg:text-6xl font-display tracking-tight transition-all duration-700 ${
              isMounted && isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            }`}
          >
            Connect your tools.
            <br />
            <span className="text-muted-foreground">One memory graph.</span>
          </h2>
        </div>

        {/* Integrations grid */}
        <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
          {integrations.map((integration, index) => (
            <div
              key={integration.name}
              className={`group p-8 lg:p-12 border border-foreground/10 transition-all duration-700 hover-lift ${
                isMounted && isVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <div className="mb-6 text-foreground/30 group-hover:text-foreground transition-colors duration-300">
                <IntegrationIcon type={integration.icon} />
              </div>
              <h3 className="text-2xl font-display mb-3">{integration.name}</h3>
              <p className="text-muted-foreground leading-relaxed">
                {integration.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
