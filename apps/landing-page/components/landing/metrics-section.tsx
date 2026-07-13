"use client";

import { useEffect, useRef, useState } from "react";

const metrics = [
  { value: "10+", label: "GitHub integrations", suffix: "repositories" },
  { value: "∞", label: "Knowledge graph", suffix: "continuously evolving" },
  { value: "Real-time", label: "Slack RTS context", suffix: "live retrieval" },
  { value: "Persistent", label: "Engineering memory", suffix: "never lost" },
];

export function MetricsSection() {
  const [isVisible, setIsVisible] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setIsMounted(true);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.3 },
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative py-24 lg:py-32 overflow-hidden"
    >
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-24">
          {metrics.map((metric, index) => (
            <div
              key={metric.label}
              className={`text-center transition-all duration-700 ${
                isMounted && isVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: `${index * 150}ms` }}
            >
              <div className="text-5xl lg:text-7xl font-display mb-3">
                {metric.value}
              </div>
              <div className="text-sm text-muted-foreground">
                {metric.label}
                <span className="block text-xs mt-1 opacity-60">
                  {metric.suffix}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
