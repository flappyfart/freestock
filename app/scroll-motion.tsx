"use client";

import { useEffect } from "react";

const TARGETS =
  ".money-story, .dashboard-grid > .panel, .draw-layout > .panel, .simulation-controls, .questions-heading, .questions-list details, .draw-history, .portfolio-section, .activity-section, .earn-section, .education-body section, .ledger article";

/** Progressive enhancement: the server renders all content visible and usable. */
export function ScrollMotion() {
  useEffect(() => {
    const scope = document.querySelector(".earn, .app-shell");
    if (!scope || !("IntersectionObserver" in window)) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const seen = new WeakSet<Element>();
    const observed = new Set<HTMLElement>();
    let intersection: IntersectionObserver | null = null;

    const show = (element: HTMLElement, animate: boolean) => {
      element.dataset.scrollReveal = animate ? "enter" : "done";
      intersection?.unobserve(element);
      observed.delete(element);
    };
    const register = () => {
      for (const element of observed) {
        if (!element.isConnected) {
          intersection?.unobserve(element);
          observed.delete(element);
        }
      }
      if (preference.matches) return;
      scope.querySelectorAll<HTMLElement>(TARGETS).forEach((element) => {
        if (seen.has(element)) return;
        seen.add(element);
        if (element.getBoundingClientRect().top < window.innerHeight * 0.95) return;
        element.dataset.scrollReveal = "pending";
        observed.add(element);
        intersection?.observe(element);
      });
    };
    const syncPreference = () => {
      intersection?.disconnect();
      for (const element of observed) show(element, false);
      if (preference.matches) {
        scope.querySelectorAll<HTMLElement>("[data-scroll-reveal]").forEach((element) => {
          delete element.dataset.scrollReveal;
        });
        return;
      }
      intersection = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) show(entry.target as HTMLElement, true);
          }
        },
        { threshold: 0, rootMargin: "0px 0px -24px 0px" },
      );
      register();
    };
    const revealFocus = (event: Event) => {
      if (!(event.target instanceof Element)) return;
      let element = event.target.closest<HTMLElement>("[data-scroll-reveal]");
      while (element) {
        show(element, false);
        element = element.parentElement?.closest<HTMLElement>("[data-scroll-reveal]") ?? null;
      }
    };
    const revealHash = () => {
      if (!window.location.hash) return;
      let target: HTMLElement | null = null;
      try {
        target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
      } catch {
        return;
      }
      const element = target?.closest<HTMLElement>("[data-scroll-reveal]");
      if (element) show(element, false);
    };
    syncPreference();
    revealHash();
    const mutations = new MutationObserver(register);
    mutations.observe(scope, { childList: true, subtree: true });
    scope.addEventListener("focusin", revealFocus);
    window.addEventListener("hashchange", revealHash);
    preference.addEventListener("change", syncPreference);
    return () => {
      intersection?.disconnect();
      mutations.disconnect();
      scope.removeEventListener("focusin", revealFocus);
      window.removeEventListener("hashchange", revealHash);
      preference.removeEventListener("change", syncPreference);
      scope.querySelectorAll<HTMLElement>("[data-scroll-reveal]").forEach((element) => {
        delete element.dataset.scrollReveal;
      });
    };
  }, []);
  return null;
}
