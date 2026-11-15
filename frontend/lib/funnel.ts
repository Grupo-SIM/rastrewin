"use client";

/*
 * Eventos personalizados do funil da landing page (só Meta: Pixel + API de Conversões, com o mesmo
 * event_id). Saem pelo t.js, então seguem o consentimento do banner: sem aceite, nada é enviado.
 * Mapa completo em docs/business-rules.md ("Meta event map").
 */
import { useEffect } from "react";
import { trck } from "./track";

type Params = Record<string, string | number>;

/** Evento personalizado do funil. ga4: false = não vai ao GA4 (o escopo destes eventos é a Meta). */
export function funnelEvent(name: string, params: Params = {}) {
	trck("track", name, { ...params, ga4: false });
}

const SCROLL_MARKS = [25, 50, 75, 90];

/**
 * SectionView, ScrollDepth e CTAClick da landing page:
 * - CTAClick: clique num elemento com data-cta="<botão>" e data-cta-section="<seção>" (o nome do botão
 *   distingue os dois "Começar": comecar_topo e comecar_hero);
 * - SectionView (uma vez por visualização): cada elemento com data-funnel-section="<nome>" conta quando
 *   30% dele (ou 30% da tela, se ele for mais alto que ela) fica visível;
 * - ScrollDepth (uma vez por faixa e por visualização): a parte de baixo da tela passa de 25, 50, 75 e
 *   90% da altura da página.
 */
export function useFunnelTracking() {
	useEffect(() => {
		const seenSections = new Set<string>();
		const observer = new IntersectionObserver(
			entries => {
				for (const e of entries) {
					const section = (e.target as HTMLElement).dataset.funnelSection;
					if (!section || seenSections.has(section) || !e.isIntersecting) continue;
					const needed = Math.min(e.boundingClientRect.height, window.innerHeight) * 0.3;
					if (e.intersectionRect.height < needed) continue;
					seenSections.add(section);
					observer.unobserve(e.target);
					funnelEvent("SectionView", { section });
				}
			},
			{ threshold: Array.from({ length: 11 }, (_, i) => i / 10) },
		);
		document.querySelectorAll("[data-funnel-section]").forEach(el => observer.observe(el));

		const onClick = (event: MouseEvent) => {
			const el = (event.target as Element | null)?.closest?.<HTMLElement>("[data-cta]");
			if (!el?.dataset.cta) return;
			funnelEvent("CTAClick", { button: el.dataset.cta, section: el.dataset.ctaSection ?? "" });
		};
		document.addEventListener("click", onClick, { capture: true });

		const reached = new Set<number>();
		let frame = 0;
		const measure = () => {
			frame = 0;
			const doc = document.documentElement;
			const percent = ((window.scrollY + window.innerHeight) / doc.scrollHeight) * 100;
			for (const mark of SCROLL_MARKS) {
				if (percent >= mark && !reached.has(mark)) {
					reached.add(mark);
					funnelEvent("ScrollDepth", { percent: mark });
				}
			}
		};
		const onScroll = () => {
			if (!frame) frame = requestAnimationFrame(measure);
		};
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => {
			observer.disconnect();
			document.removeEventListener("click", onClick, { capture: true });
			window.removeEventListener("scroll", onScroll);
			if (frame) cancelAnimationFrame(frame);
		};
	}, []);
}
