"use client";

import { useEffect, useState, useRef } from "react";

const layers = [
  {
    name: "Slack Agent",
    tech: "Bolt SDK",
    description:
      "Slash commands, mentions, threads, streaming responses, agent home",
  },
  {
    name: "Planner",
    tech: "Gemini 2.5 Flash",
    description:
      "Intent detection, task decomposition, context retrieval, tool selection, reflection",
  },
  {
    name: "Memory Graph",
    tech: "Cognee Cloud",
    description:
      "Persistent knowledge graph with entities, relationships, embeddings, and semantic search",
  },
  {
    name: "Tool Router",
    tech: "MCP Protocol",
    description:
      "Unified access to GitHub, Google Docs, Slack RTS, and future MCP servers",
  },
  {
    name: "Storage",
    tech: "PostgreSQL + Redis",
    description: "Workspace metadata, OAuth tokens, queue management, caching",
  },
  {
    name: "Workers",
    tech: "BullMQ",
    description:
      "Repository sync, graph building, relationship extraction, webhook processing",
  },
];

export function InfrastructureSection() {
  const [isVisible, setIsVisible] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [activeLayer, setActiveLayer] = useState(0);
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

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveLayer((prev) => (prev + 1) % layers.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative py-24 lg:py-32 overflow-hidden"
    >
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12">
        {/* Header */}
        <div className="mb-16 lg:mb-24">
          <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
            <span className="w-8 h-px bg-foreground/30" />
            Architecture
          </span>
          <h2
            className={`text-4xl lg:text-6xl font-display tracking-tight transition-all duration-700 ${
              isMounted && isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            }`}
          >
            Built on proven technology.
            <br />
            <span className="text-muted-foreground">Designed for scale.</span>
          </h2>
        </div>

        {/* Architecture diagram */}
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          {/* Visual stack */}
          <div className="space-y-0">
            {layers.map((layer, index) => (
              <div
                key={layer.name}
                className={`py-4 border-b border-foreground/10 transition-all duration-500 cursor-pointer ${
                  activeLayer === index
                    ? "opacity-100"
                    : "opacity-30 hover:opacity-60"
                }`}
                onClick={() => setActiveLayer(index)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-display">{layer.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {layer.description}
                    </p>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground bg-foreground/5 px-3 py-1 rounded-full">
                    {layer.tech}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Architecture flow */}
          <div className="relative">
            <div className="border border-foreground/10 p-8 lg:p-12">
              <div className="space-y-6">
                {/* Flow diagram */}
                {[
                  { from: "Slack", to: "Agent", arrow: "↓" },
                  { from: "Agent", to: "Planner", arrow: "↓" },
                  { from: "Planner", to: "Memory Graph", arrow: "↔" },
                  { from: "Planner", to: "Tool Router", arrow: "↓" },
                  {
                    from: "Tool Router",
                    to: "GitHub · Docs · Slack RTS",
                    arrow: "→",
                  },
                ].map((step, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <div
                      className={`text-sm font-mono px-4 py-2 border border-foreground/10 transition-all duration-500 ${
                        activeLayer === i || (i === 4 && activeLayer >= 4)
                          ? "bg-foreground text-background"
                          : ""
                      }`}
                    >
                      {step.from}
                    </div>
                    <span className="text-xs font-mono text-muted-foreground py-1">
                      {step.arrow}
                    </span>
                    {i === 4 && (
                      <div
                        className={`text-sm font-mono px-4 py-2 border border-foreground/10 transition-all duration-500 ${
                          activeLayer >= 4
                            ? "bg-foreground text-background"
                            : ""
                        }`}
                      >
                        {step.to}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Active layer detail */}
            <div className="mt-8 p-6 border border-foreground/10 bg-foreground/[0.02]">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-2 h-2 rounded-full bg-foreground/30 animate-pulse" />
                <span className="text-xs font-mono text-muted-foreground">
                  Active layer
                </span>
              </div>
              <p className="text-sm">
                <span className="font-display text-lg">
                  {layers[activeLayer].name}
                </span>
                <br />
                <span className="text-muted-foreground">
                  {layers[activeLayer].description}
                </span>
                <br />
                <span className="text-xs font-mono text-muted-foreground mt-2 inline-block">
                  Powered by {layers[activeLayer].tech}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
