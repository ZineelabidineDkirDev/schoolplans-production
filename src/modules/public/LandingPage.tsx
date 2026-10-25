import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { getSupabaseClient } from '../../data/supabase/client';

const features = [
  [
    '↗',
    'Planning intelligent',
    'Visualisez les cours, salles, formateurs et créneaux sans vous perdre dans les tableaux.',
    'Créer & modifier des cours',
    'blue',
  ],
  [
    '◉',
    'Suivi des étudiants',
    'Retrouvez les dossiers, inscriptions et informations essentielles depuis un seul espace.',
    'Gérer les étudiants',
    'teal',
  ],
  [
    '✓',
    'Présences & assiduité',
    'Les formateurs pointent les séances et le centre garde une vision fiable de la présence.',
    'Suivre les présences',
    'violet',
  ],
  [
    '▣',
    'Supports & documents',
    'Centralisez les ressources pédagogiques et gardez les documents utiles accessibles.',
    'Partager les supports',
    'amber',
  ],
  [
    '★',
    'Certificats PDF',
    'Émettez les certificats depuis l’application et retrouvez l’historique des documents délivrés.',
    'Générer un certificat',
    'pink',
  ],
  [
    '⌁',
    'Espaces par rôle',
    'Super Admin, Directeur, Formateur et Étudiant voient uniquement ce qui les concerne.',
    'Accès adaptés',
    'slate',
  ],
  [
    '▤',
    'Formations & groupes',
    'Structurez vos programmes, répartissez les étudiants en groupes et suivez les périodes de formation.',
    'Organiser les formations',
    'blue',
  ],
  [
    '◷',
    'Gestion des séances',
    'Suivez les séances planifiées et réalisées pour garder une vision claire de l’avancement pédagogique.',
    'Suivre les séances',
    'teal',
  ],
  [
    '⌂',
    'Cours en ligne',
    'Regroupez les ressources et contenus pédagogiques en ligne pour faciliter l’accès aux apprentissages.',
    'Accéder aux cours',
    'violet',
  ],
  [
    '▥',
    'Gestion financière',
    'Centralisez le suivi des paiements, des dépenses et des opérations financières de votre centre.',
    'Suivre les finances',
    'amber',
  ],
  [
    '▧',
    'Rapports & statistiques',
    'Consultez les indicateurs et rapports pour mieux comprendre l’activité de votre centre et de vos formateurs.',
    'Analyser l’activité',
    'pink',
  ],
  [
    '⇄',
    'Import & export Excel',
    'Importez vos données et exportez les informations utiles pour simplifier le suivi administratif.',
    'Échanger les données',
    'slate',
  ],
];

const plans = [
  {
    name: 'STARTER',
    label: 'Pour démarrer',
    price: '1 490',
    description: 'Les fonctions essentielles pour organiser les activités de votre centre.',
    includes: 'Les fondamentaux de gestion',
    items: [
      'Étudiants & formateurs',
      'Formations, groupes & matières',
      'Cours, planning & salles',
      'Import / export Excel',
    ],
  },
  {
    name: 'STANDARD',
    label: 'Pour un centre actif',
    price: '2 990',
    description: 'Pour suivre plus facilement les cours et le quotidien pédagogique.',
    includes: 'Le suivi pédagogique',
    items: [
      'Toutes les bases Starter',
      'Gestion et suivi des séances',
      'Présences & assiduité',
      'Supports, documents & certificats PDF',
    ],
  },
  {
    name: 'PROFESSIONAL',
    label: 'Pour aller plus loin',
    price: '5 990',
    description: 'Des outils supplémentaires pour analyser et piloter l’activité du centre.',
    includes: 'Le pilotage avancé',
    items: [
      'Toutes les bases Standard',
      'Rapports & statistiques',
      'Cours en ligne',
      'Gestion financière',
    ],
    featured: true,
  },
];

const comparisonFeatures = [
  { label: 'Étudiants & formateurs', available: [true, true, true] },
  { label: 'Formations, groupes & matières', available: [true, true, true] },
  { label: 'Cours, planning & salles', available: [true, true, true] },
  { label: 'Import / export Excel', available: [true, true, true] },
  { label: 'Gestion et suivi des séances', available: [false, true, true] },
  { label: 'Présences & assiduité', available: [false, true, true] },
  { label: 'Supports, documents & certificats PDF', available: [false, true, true] },
  { label: 'Rapports & statistiques', available: [false, false, true] },
  { label: 'Cours en ligne', available: [false, false, true] },
  { label: 'Gestion financière', available: [false, false, true] },
];

const questions = [
  [
    'Qu’est-ce que Madrassa-Ti ?',
    'Madrassa-Ti est une plateforme de gestion destinée aux centres de formation pour centraliser le planning, les étudiants, les formateurs, les salles, les présences et les documents.',
  ],
  [
    'Les données de chaque centre sont-elles séparées ?',
    'Oui. Le fonctionnement multi-centres est conçu pour isoler les données de chaque centre et réserver les accès selon le profil de l’utilisateur.',
  ],
  [
    'Quels rôles sont disponibles ?',
    'La plateforme prévoit un Super Admin, un Directeur, un Manager, un Formateur et un Étudiant, avec des droits adaptés à chaque espace.',
  ],
  [
    'Les étudiants peuvent-ils s’inscrire avec Google ?',
    'Oui. Le workflow existant permet à un étudiant de se connecter avec Google, choisir son centre puis envoyer une demande d’inscription.',
  ],
  [
    'Y a-t-il une période d’essai ?',
    'Oui. Le modèle de Madrassa-Ti prévoit une période de démonstration gratuite de 14 jours.',
  ],
];

function AnimatedMetric({ label, value }: { label: string; value: number }) {
  const [count, setCount] = useState(0);
  const metricRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = metricRef.current;
    if (!element) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setCount(value);
      return;
    }

    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const startTime = performance.now();
        const update = (now: number) => {
          const progress = Math.min((now - startTime) / 1200, 1);
          setCount(Math.round(value * progress));
          if (progress < 1) frame = requestAnimationFrame(update);
        };
        frame = requestAnimationFrame(update);
      },
      { threshold: 0.5 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [value]);

  return (
    <div ref={metricRef}>
      <strong>{count}</strong>
      <span>{label}</span>
    </div>
  );
}

export function LandingPage() {
  const { status, profile, session } = useAuth();
  const connected = status === 'authenticated' && profile !== null;
  const connectedLabel = profile?.fullName?.trim() || session?.user.email || 'Mon espace';
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [pricingIndex, setPricingIndex] = useState(2);
  const [contactMessage, setContactMessage] = useState('');
  const [subscriptionPlan, setSubscriptionPlan] = useState<(typeof plans)[number] | null>(null);
  const [subscriptionMessage, setSubscriptionMessage] = useState('');
  const [demoOpen, setDemoOpen] = useState(false);
  const [demoMessage, setDemoMessage] = useState('');
  const [demoSubmitting, setDemoSubmitting] = useState(false);
  const [subscriptionSubmitting, setSubscriptionSubmitting] = useState(false);
  const pricingViewport = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncScroll = () => setScrolled(window.scrollY > 40);
    syncScroll();
    window.addEventListener('scroll', syncScroll, { passive: true });
    return () => window.removeEventListener('scroll', syncScroll);
  }, []);

  useEffect(() => {
    const viewport = pricingViewport.current;
    const card = viewport?.querySelector<HTMLElement>('.sp-landing-plan');
    if (!viewport || !card) return;
    const step = card.offsetWidth + 16;
    viewport.scrollLeft = step * 2;
    setPricingIndex(2);
  }, []);

  function syncPricingIndex() {
    const viewport = pricingViewport.current;
    const card = viewport?.querySelector<HTMLElement>('.sp-landing-plan');
    if (!viewport || !card) return;
    const step = card.offsetWidth + 16;
    setPricingIndex(Math.max(0, Math.min(plans.length - 1, Math.round(viewport.scrollLeft / step))));
  }

  function movePricing(direction: -1 | 1) {
    const viewport = pricingViewport.current;
    if (!viewport) return;
    const nextIndex = Math.max(0, Math.min(plans.length - 1, pricingIndex + direction));
    setPricingIndex(nextIndex);
    const card = viewport.querySelector<HTMLElement>('.sp-landing-plan');
    const step = card ? card.offsetWidth + 16 : viewport.clientWidth;
    viewport.scrollTo({ left: nextIndex * step, behavior: 'smooth' });
  }

  async function submitSubscription(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subscriptionPlan) return;
    setSubscriptionSubmitting(true);
    setSubscriptionMessage('');
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const { error } = await getSupabaseClient().from('subscription_requests').insert({
      contact_name: String(form.get('contact_name') ?? '').trim(),
      centre_name: String(form.get('centre_name') ?? '').trim(),
      email: String(form.get('email') ?? '').trim(),
      phone: String(form.get('phone') ?? '').trim(),
      plan: subscriptionPlan.name,
      annual_price_mad: Number(subscriptionPlan.price.replace(/\s/g, '')),
    });
    if (error) {
      setSubscriptionMessage('Impossible d’envoyer la demande pour le moment. Vérifiez la configuration Supabase et réessayez.');
    } else {
      setSubscriptionMessage('Votre demande a bien été enregistrée. Notre équipe vous contactera pour la suite du paiement.');
      formElement.reset();
    }
    setSubscriptionSubmitting(false);
  }

  async function submitDemo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDemoSubmitting(true);
    setDemoMessage('');
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const { error } = await getSupabaseClient().from('demo_requests').insert({
      contact_name: String(form.get('contact_name') ?? '').trim(),
      centre_name: String(form.get('centre_name') ?? '').trim(),
      email: String(form.get('email') ?? '').trim(),
      phone: String(form.get('phone') ?? '').trim(),
    });
    if (error) {
      setDemoMessage('Impossible d’envoyer la demande pour le moment. Vérifiez la configuration Supabase et réessayez.');
    } else {
      setDemoMessage('Votre demande de démo a été envoyée. La période de 14 jours commencera uniquement après validation par notre Super Admin.');
      formElement.reset();
    }
    setDemoSubmitting(false);
  }

  function submitContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    const phone = String(data.get('phone') ?? '').trim();
    const formation = String(data.get('subject') ?? 'Démonstration Madrassa-Ti');
    const text = String(data.get('message') ?? '').trim();
    const body = `Nom : ${name}\nTéléphone : ${phone}\nFormation : ${formation}\n\n${text}`;
    setContactMessage('Votre application de messagerie va s’ouvrir avec la demande préremplie.');
    window.location.href = `mailto:contact@test-formation.ma?subject=${encodeURIComponent(`Demande d'information - ${formation}`)}&body=${encodeURIComponent(body)}`;
  }

  return (
    <main className="sp-landing" id="landing">
      <style>{`
#lp-pricing .sp-landing-pricing-hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,.78fr);align-items:center;gap:clamp(22px,4vw,48px);margin:0 0 28px}
#lp-pricing .sp-landing-pricing-hero .sp-landing-section-heading{margin:0}
#lp-pricing .sp-landing-demo-card{position:relative;isolation:isolate;overflow:hidden;max-width:900px;margin:0 auto 30px;border:1px solid rgba(59,130,246,.22);border-radius:24px;background:linear-gradient(120deg,var(--sp-card,#fff) 0%,#f5f8ff 58%,#eef5ff 100%);box-shadow:0 18px 55px -32px rgba(37,99,235,.38)}
#lp-pricing .sp-landing-demo-card-compact{width:100%;max-width:none;margin:0}
#lp-pricing .sp-landing-demo-card-compact .sp-landing-demo-card-content{padding:22px}
#lp-pricing .sp-landing-demo-card-compact .sp-landing-demo-main{display:block;margin:17px 0}
#lp-pricing .sp-landing-demo-card-compact .sp-landing-demo-main h3{font-size:1.35rem}
#lp-pricing .sp-landing-demo-card-compact .sp-landing-demo-main p{font-size:.9rem}
#lp-pricing .sp-landing-demo-card-compact .sp-landing-demo-price{margin-top:14px}
#lp-pricing .sp-landing-demo-card-compact .sp-landing-demo-price strong{font-size:2.7rem}
#lp-pricing .sp-landing-demo-card-compact .sp-landing-demo-bottom{display:block;padding-top:16px}
#lp-pricing .sp-landing-demo-card-compact .sp-landing-demo-bottom p{font-size:.82rem;margin-bottom:14px}
#lp-pricing .sp-landing-demo-card-compact .sp-landing-demo-cta{width:100%;padding:11px 12px;font-size:.9rem}
@media(max-width:760px){#lp-pricing .sp-landing-pricing-hero{grid-template-columns:1fr;gap:24px}#lp-pricing .sp-landing-demo-card-compact{max-width:460px;margin:0 auto}#lp-pricing .sp-landing-demo-card-compact .sp-landing-demo-main{display:flex;align-items:center}}
#lp-pricing .sp-landing-demo-card-glow{position:absolute;z-index:-1;width:280px;height:280px;right:-70px;top:-145px;border-radius:50%;background:radial-gradient(circle,rgba(59,130,246,.2),rgba(59,130,246,0) 70%);pointer-events:none}
#lp-pricing .sp-landing-demo-card-content{padding:clamp(22px,4vw,34px)}
#lp-pricing .sp-landing-demo-eyebrow{display:inline-flex;align-items:center;gap:9px;padding:7px 12px;border:1px solid rgba(37,99,235,.16);border-radius:999px;background:rgba(255,255,255,.78);color:#2458b8;font-size:.72rem;font-weight:800;letter-spacing:.1em}
#lp-pricing .sp-landing-demo-dot{width:7px;height:7px;border-radius:50%;background:#3b82f6;box-shadow:0 0 0 4px rgba(59,130,246,.12)}
#lp-pricing .sp-landing-demo-main{display:flex;align-items:center;justify-content:space-between;gap:24px;margin:22px 0}
#lp-pricing .sp-landing-demo-main h3{margin:0;color:var(--sp-heading,#172554);font-size:clamp(1.45rem,3vw,2rem);font-weight:800;letter-spacing:-.035em;line-height:1.2}
#lp-pricing .sp-landing-demo-main h3 span{color:#2563eb}
#lp-pricing .sp-landing-demo-main p{max-width:540px;margin:10px 0 0;color:var(--sp-muted,#64748b);line-height:1.65}
#lp-pricing .sp-landing-demo-price{display:flex;align-items:baseline;gap:7px;flex-shrink:0;color:#1d4ed8}
#lp-pricing .sp-landing-demo-price strong{font-size:clamp(2.8rem,6vw,4rem);font-weight:850;letter-spacing:-.07em;line-height:1}
#lp-pricing .sp-landing-demo-price span{font-size:1.05rem;font-weight:800}
#lp-pricing .sp-landing-demo-bottom{display:flex;align-items:center;justify-content:space-between;gap:20px;padding-top:20px;border-top:1px solid rgba(59,130,246,.14)}
#lp-pricing .sp-landing-demo-bottom p{display:flex;align-items:flex-start;gap:9px;margin:0;color:var(--sp-muted,#64748b);font-size:.9rem;line-height:1.55}
#lp-pricing .sp-landing-demo-bottom p span{display:grid;place-items:center;flex:0 0 20px;width:20px;height:20px;border-radius:50%;background:#dbeafe;color:#1d4ed8;font-size:.75rem;font-weight:900}
#lp-pricing .sp-landing-demo-cta{display:inline-flex;align-items:center;justify-content:center;gap:12px;flex-shrink:0;padding:13px 18px;border:0;border-radius:12px;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;font-weight:750;box-shadow:0 8px 20px rgba(37,99,235,.23);transition:transform .2s ease,box-shadow .2s ease}
#lp-pricing .sp-landing-demo-cta:hover{transform:translateY(-2px);box-shadow:0 12px 26px rgba(37,99,235,.3)}
#lp-pricing .sp-landing-demo-cta:focus-visible{outline:3px solid #93c5fd;outline-offset:3px}
@media(max-width:640px){#lp-pricing .sp-landing-demo-main{align-items:flex-start;gap:14px}#lp-pricing .sp-landing-demo-price strong{font-size:2.8rem}#lp-pricing .sp-landing-demo-bottom{align-items:stretch;flex-direction:column}#lp-pricing .sp-landing-demo-cta{width:100%}}
@media(prefers-reduced-motion:reduce){#lp-pricing .sp-landing-demo-cta{transition:none}}

#lp-pricing .sp-landing-pricing-viewport{overflow-x:auto;overflow-y:visible;perspective:1400px;scroll-snap-type:x mandatory;scrollbar-width:none;padding:34px max(8px,calc((100% - 340px)/2)) 42px;margin:-18px 0;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch}
#lp-pricing .sp-landing-pricing-viewport::-webkit-scrollbar{display:none}
#lp-pricing .sp-landing-pricing-track{display:flex;align-items:stretch;gap:16px;width:max-content;transform-style:preserve-3d}
#lp-pricing .sp-landing-plan{flex:0 0 min(340px,calc(100vw - 56px));scroll-snap-align:center;transform:rotateY(-7deg) scale(.94) translateZ(-24px);transform-origin:center;opacity:.76;filter:saturate(.82);transition:transform .55s cubic-bezier(.2,.75,.25,1),opacity .4s ease,filter .4s ease,box-shadow .4s ease;backface-visibility:hidden}
#lp-pricing .sp-landing-plan:nth-child(even){transform:rotateY(7deg) scale(.94) translateZ(-24px)}
#lp-pricing .sp-landing-plan.is-active{transform:rotateY(0) scale(1.035) translateZ(28px);opacity:1;filter:none;box-shadow:0 28px 65px -30px rgba(25,55,120,.48);z-index:2}
#lp-pricing .sp-landing-plan.is-featured.is-active{transform:rotateY(0) scale(1.045) translateZ(36px)}
@media(max-width:600px){#lp-pricing .sp-landing-pricing-viewport{padding-inline:calc((100vw - min(340px,100vw - 56px))/2)}#lp-pricing .sp-landing-plan{transform:rotateY(-4deg) scale(.96)}#lp-pricing .sp-landing-plan:nth-child(even){transform:rotateY(4deg) scale(.96)}#lp-pricing .sp-landing-plan.is-active{transform:rotateY(0) scale(1.015) translateZ(12px)}}
@media(prefers-reduced-motion:reduce){#lp-pricing .sp-landing-plan{transition:none!important}}
#lp-pricing .sp-landing-comparison{margin:34px auto 0;max-width:1080px;border:1px solid var(--sp-border,#e5eaf3);border-radius:18px;overflow:hidden;background:var(--sp-card,#fff);box-shadow:0 12px 35px rgba(26,48,90,.05)}
#lp-pricing .sp-landing-comparison-heading{padding:22px 24px 16px}
#lp-pricing .sp-landing-comparison-heading h3{margin:0 0 6px;color:var(--sp-heading,#172554);font-size:1.2rem}
#lp-pricing .sp-landing-comparison-heading p{margin:0;color:var(--sp-muted,#64748b);font-size:.92rem}
#lp-pricing .sp-landing-comparison-scroll{overflow-x:auto}
#lp-pricing .sp-landing-comparison table{width:100%;border-collapse:collapse;min-width:650px;text-align:center}
#lp-pricing .sp-landing-comparison th,#lp-pricing .sp-landing-comparison td{padding:13px 16px;border-top:1px solid var(--sp-border,#e5eaf3)}
#lp-pricing .sp-landing-comparison thead th{font-size:.82rem;color:var(--sp-heading,#172554);font-weight:750;background:var(--sp-soft,#f8fafc)}
#lp-pricing .sp-landing-comparison th:first-child,#lp-pricing .sp-landing-comparison td:first-child{text-align:left;width:42%}
#lp-pricing .sp-landing-comparison tbody th{font-weight:550;font-size:.9rem;color:var(--sp-text,#334155)}
#lp-pricing .sp-landing-comparison .sp-compare-check{color:var(--sp-primary,#2563eb);font-size:1.1rem;font-weight:800}
#lp-pricing .sp-landing-comparison .sp-compare-no{color:var(--sp-muted,#94a3b8)}
#lp-pricing .sp-landing-comparison .sp-compare-featured{color:var(--sp-primary,#2563eb);background:rgba(37,99,235,.045)}
#lp-pricing .sp-landing-comparison thead .sp-compare-featured{background:rgba(37,99,235,.08)}
@media(max-width:640px){#lp-pricing .sp-landing-comparison{margin-top:24px;border-radius:14px}#lp-pricing .sp-landing-comparison-heading{padding:18px 16px 14px}#lp-pricing .sp-landing-comparison th,#lp-pricing .sp-landing-comparison td{padding:12px 13px}}

`}</style>
      <header
        className={`sp-landing-nav${menuOpen ? ' menu-open' : ''}${scrolled ? ' is-scrolled' : ''}`}
      >
        <Link aria-label="Madrassa-Ti, accueil" className="sp-landing-brand" to="/">
          <span className="sp-landing-mark">
            <i />
            <i />
            <i />
          </span>
          <span>
            Madrassa<span>-Ti</span>
          </span>
        </Link>
        <button
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          className="sp-landing-menu-toggle"
          onClick={() => setMenuOpen((open) => !open)}
          type="button"
        >
          <span />
          <span />
          <span />
        </button>
        <nav aria-label="Navigation du site" className="sp-landing-links">
          {[
            ['Fonctionnalités', '#lp-dom'],
            ['Comment ça marche', '#lp-app'],
            ['Pourquoi Madrassa-Ti', '#lp-why'],
            ['Tarifs', '#lp-pricing'],
            ['FAQ', '#lp-faq'],
          ].map(([label, href]) => (
            <a href={href} key={href} onClick={() => setMenuOpen(false)}>
              {label}
            </a>
          ))}
          <a href="#lp-ct" onClick={() => setMenuOpen(false)}>
            Nous contacter
          </a>
          {connected ? (
            <Link aria-label={`Ouvrir l’espace de ${connectedLabel}`} className="sp-landing-login" to="/app">
              <span className="sp-landing-account-name">{connectedLabel}</span>
              <span aria-hidden="true">→</span>
            </Link>
          ) : (
            <Link className="sp-landing-login" to="/login">
              Se connecter <span aria-hidden="true">→</span>
            </Link>
          )}
        </nav>
      </header>

      <section aria-label="Présentation de Madrassa-Ti" className="sp-landing-hero">
        <div className="sp-landing-hero-inner">
          <div className="sp-landing-hero-copy">
            <span className="sp-landing-pill">
              <i />
              La plateforme de gestion pour les centres de formation et les écoles
            </span>
            <h1>
              Gérez votre centre.
              <br />
              <span>Simplement.</span>
            </h1>
            <p>
              Madrassa-Ti centralise les étudiants, formateurs, cours, salles, formations, présences
              et documents dans un seul espace clair et professionnel.
            </p>
            <div className="sp-landing-actions">
              <Link className="sp-landing-button sp-landing-button-primary" to="/login">
                Accéder à mon espace <span>→</span>
              </Link>
              <a className="sp-landing-button sp-landing-button-text" href="#lp-dom">
                Découvrir la plateforme <span>↓</span>
              </a>
            </div>
            <div className="sp-landing-trust">
              <div>
                <strong>+40</strong>
                <span>Formations</span>
              </div>
              <i />
              <div>
                <strong>24/7</strong>
                <span>accès en ligne</span>
              </div>
              <i />
              <div>
                <strong>100%</strong>
                <span>responsive</span>
              </div>
            </div>
          </div>
          <div aria-hidden="true" className="sp-landing-product">
            <div className="sp-landing-window">
              <div className="sp-landing-window-top">
                <div>
                  <span className="sp-landing-mini-mark">
                    <i />
                    <i />
                    <i />
                  </span>
                  <b>Madrassa-Ti</b>
                </div>
                <span className="sp-landing-window-user">
                  <i />
                  <i />
                </span>
              </div>
              <div className="sp-landing-window-body">
                <div className="sp-landing-window-sidebar">
                  <i className="is-active">▦</i>
                  <i>▥</i>
                  <i>☷</i>
                  <i>◉</i>
                  <i>✓</i>
                </div>
                <div className="sp-landing-calendar">
                  <div className="sp-landing-calendar-head">
                    <span>
                      <small>Cette semaine</small>
                      <b>Planning</b>
                    </span>
                    <i>6–11 OCT.</i>
                  </div>
                  <div className="sp-landing-week-days">
                    <b />
                    <b>LUN</b>
                    <b>MAR</b>
                    <b>MER</b>
                    <b>JEU</b>
                    <b>VEN</b>
                    <b>SAM</b>
                  </div>
                  <div className="sp-landing-week-grid">
                    <small>09h</small>
                    <i />
                    <i>
                      <b className="is-data">Power BI</b>
                    </i>
                    <i />
                    <i>
                      <b className="is-lang">Français</b>
                    </i>
                    <i />
                    <i>
                      <b className="is-bur">Excel</b>
                    </i>
                    <small>11h</small>
                    <i>
                      <b className="is-math">Maths</b>
                    </i>
                    <i />
                    <i />
                    <i>
                      <b className="is-data">SQL</b>
                    </i>
                    <i />
                    <i />
                    <small>14h</small>
                    <i />
                    <i>
                      <b className="is-lang">Anglais</b>
                    </i>
                    <i>
                      <b className="is-bur">Word</b>
                    </i>
                    <i />
                    <i>
                      <b className="is-data">Python</b>
                    </i>
                    <i />
                    <small>16h</small>
                    <i>
                      <b className="is-data">Data</b>
                    </i>
                    <i />
                    <i />
                    <i>
                      <b className="is-lang">Allemand</b>
                    </i>
                    <i />
                    <i>
                      <b className="is-bur">Excel</b>
                    </i>
                  </div>
                  <div className="sp-landing-kpis">
                    <span>
                      <small>Étudiants</small>
                      <b>+228</b>
                    </span>
                    <span>
                      <small>Formateurs</small>
                      <b>+40</b>
                    </span>
                    <span>
                      <small>Présences</small>
                      <b>94%</b>
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="sp-landing-float sp-landing-float-one">
              <b>✓</b>
              <span>
                <strong>Présences</strong>
                <small>Suivi en temps réel</small>
              </span>
            </div>
            <div className="sp-landing-float sp-landing-float-two">
              <b>+</b>
              <span>
                <strong>Planning</strong>
                <small>Mis à jour en 1 clic</small>
              </span>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Fonctionnalités de la plateforme" className="sp-landing-band">
        <span>Tout ce qu’il faut pour piloter un centre de formation</span>
        <div>
          {[
            'Rapport intelligent',
            'Formations & groupes',
            'Étudiants',
            'Formateurs',
            'Planning',
            'Présences',
            'Documents',
          ].map((item) => (
            <b key={item}>{item}</b>
          ))}
        </div>
      </section>

      <section className="sp-landing-section" id="lp-dom">
        <div className="sp-landing-container">
          <p className="sp-landing-kicker">UNE PLATEFORME, UN SEUL ESPACE</p>
          <div className="sp-landing-section-heading">
            <h2>
              Tout votre centre,
              <br />
              <span>au même endroit.</span>
            </h2>
            <p>
              Une interface pensée pour réduire les tâches administratives et donner à chaque profil
              une expérience claire.
            </p>
          </div>
          <div className="sp-landing-feature-grid">
            {features.map(([icon, title, description, label, tone]) => (
              <article className={`sp-landing-feature tone-${tone}`} key={title}>
                <span aria-hidden="true">{icon}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                  <b>{label}</b>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section aria-label="Chiffres clés" className="sp-landing-stats">
        {(
          [
            [5, 'rôles gérés'],
            [6, 'jours de planning'],
            [14, 'jours d’essai'],
            [1, 'plateforme multi-centres'],
          ] as const
        ).map(([value, label]) => (
          <AnimatedMetric key={label} label={label} value={value} />
        ))}
      </section>

      <section className="sp-landing-section sp-landing-section-soft" id="lp-app">
        <div className="sp-landing-container sp-landing-howto">
          <div>
            <p className="sp-landing-kicker">UNE PRISE EN MAIN RAPIDE</p>
            <h2>
              De la première connexion
              <br />
              <span>au pilotage quotidien.</span>
            </h2>
            <p className="sp-landing-muted">
              Madrassa-Ti garde les flux simples : chacun se connecte, retrouve son espace et
              travaille avec les informations utiles à son rôle.
            </p>
            <div className="sp-landing-steps">
              {[
                [
                  '01',
                  'Connectez-vous à votre espace',
                  'Le Super Admin, le Directeur, le Formateur et l’Étudiant retrouvent un espace adapté à leur rôle et à leurs autorisations.',
                ],
                [
                  '02',
                  'Configurez formations et groupes',
                  'Créez vos formations, associez les matières, inscrivez les étudiants et affectez les formateurs.',
                ],
                [
                  '03',
                  'Planifiez les cours et les séances',
                  'Organisez les créneaux et les salles dans un planning lisible, avec les cours et formateurs concernés.',
                ],
                [
                  '04',
                  'Suivez les résultats au quotidien',
                  'Consultez les présences, les séances réalisées, les certificats, les documents et les rapports disponibles selon votre formule.',
                ],
                [
                  '05',
                  'Pilotez votre centre',
                  'Utilisez les statistiques, les échanges Excel et, selon les droits activés, le suivi financier pour mieux décider.',
                ],
              ].map(([number, title, description]) => (
                <article key={number}>
                  <span>{number}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
          <div className="sp-landing-side-panel">
            <div className="sp-landing-side-heading">
              <small>Centre de formation</small>
              <b>Vue d’ensemble</b>
            </div>
            <div className="sp-landing-side-person">
              <i>YA</i>
              <span>
                <b>Yassine El Amrani</b>
                <small>Étudiant · Centre Privilège</small>
              </span>
              <em>Actif</em>
            </div>
            <div className="sp-landing-side-person">
              <i>RA</i>
              <span>
                <b>Razan Allouch</b>
                <small>Formateur · Langues</small>
              </span>
              <em>Actif</em>
            </div>
            <div className="sp-landing-side-chart">
              <div>
                <small>Présences cette semaine</small>
                <b>94%</b>
              </div>
              <span>
                {[36, 58, 48, 78, 66, 88].map((height) => (
                  <i key={height} style={{ height: `${height}%` }} />
                ))}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="sp-landing-section sp-landing-section-soft" id="lp-why">
        <div className="sp-landing-container">
          <p className="sp-landing-kicker">POUR LES CENTRES QUI VEULENT GAGNER DU TEMPS</p>
          <div className="sp-landing-section-heading">
            <h2>
              Une gestion plus claire.
              <br />
              <span>Un quotidien plus simple.</span>
            </h2>
            <p>
              Une base solide pour faire évoluer votre centre sans multiplier les outils, les
              fichiers Excel et les échanges dispersés.
            </p>
          </div>
          <div className="sp-landing-benefit-grid">
            {[
              [
                '01',
                'Moins d’administratif',
                'Les informations essentielles sont regroupées et accessibles depuis la même interface.',
              ],
              [
                '02',
                'Plus de visibilité',
                'Les cours, salles, formateurs et présences restent lisibles pour chaque profil.',
              ],
              [
                '03',
                'Une base SaaS évolutive',
                'Une plateforme peut accompagner plusieurs centres avec une isolation des données.',
              ],
            ].map(([number, title, description]) => (
              <article key={number}>
                <strong>{number}</strong>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section aria-label="Tarifs Madrassa-Ti" className="sp-landing-section" id="lp-pricing">
        <div className="sp-landing-container">
          <p className="sp-landing-kicker">DES OFFRES SIMPLES</p>
          <div className="sp-landing-pricing-hero">
            <div className="sp-landing-section-heading">
              <h2>
                Choisissez votre
                <br />
                <span>formule Madrassa-Ti.</span>
              </h2>
            </div>
            <article className="sp-landing-demo-card sp-landing-demo-card-compact">
              <div className="sp-landing-demo-card-glow" aria-hidden="true" />
              <div className="sp-landing-demo-card-content">
               
                <div className="sp-landing-demo-main">
                  <div>
                    <h3>Démo gratuite <span>14 jours</span></h3>
                    <p>Découvrez Madrassa-Ti avant de choisir votre formule.</p>
                  </div>
                </div>
                <div className="sp-landing-demo-bottom">
                  <button className="sp-landing-demo-cta" onClick={() => { setDemoMessage(''); setDemoOpen(true); }} type="button">Demander la démo <span aria-hidden="true">→</span></button>
                </div>
              </div>
            </article>
          </div>
          <div className="sp-landing-price-intro">
            <span>FACTURATION ANNUELLE</span>
            <b>Choisissez une formule annuelle</b>
          </div>
          <div className="sp-landing-pricing-viewport" onScroll={syncPricingIndex} ref={pricingViewport}>
            <div className="sp-landing-pricing-track">
              {plans.map((plan) => (
                <article
                  className={`sp-landing-plan${plan.featured ? ' is-featured' : ''}${plans[pricingIndex]?.name === plan.name ? ' is-active' : ''}`}
                  key={plan.name}
                >
                  {plan.featured && <span className="sp-landing-plan-badge">Le plus choisi</span>}
                  <small>{plan.label}</small>
                  <h3>{plan.name}</h3>
                  <p className="sp-landing-price">
                    <strong>
                      {plan.name === 'ENTERPRISE' ? 'À partir de ' : ''}
                      {plan.price}
                    </strong>
                    <span>DH / an</span>
                  </p>
                  <p>{plan.description}</p>
                  <b className="sp-landing-plan-includes">{plan.includes}</b>
                  <ul>
                    {plan.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <button
                    className="sp-landing-plan-cta"
                    onClick={() => {
                      setSubscriptionMessage('');
                      setSubscriptionPlan(plan);
                    }}
                    type="button"
                  >
                    {plan.name === 'ENTERPRISE' ? 'Nous contacter' : 'Choisir ce pack →'}
                  </button>
                  <small className="sp-landing-plan-note">
                    Sans engagement pendant la démonstration
                  </small>
                </article>
              ))}
            </div>
          </div>
          <div aria-label="Navigation des tarifs" className="sp-landing-price-controls">
            <button
              aria-label="Tarif précédent"
              disabled={pricingIndex === 0}
              onClick={() => movePricing(-1)}
              type="button"
            >
              ‹
            </button>
            <div>
              {plans.map((plan, index) => (
                <button
                  aria-label={`Afficher ${plan.name}`}
                  aria-pressed={index === pricingIndex}
                  className={index === pricingIndex ? 'is-active' : ''}
                  key={plan.name}
                  onClick={() => {
                    setPricingIndex(index);
                    const viewport = pricingViewport.current;
                    const card = viewport?.querySelector<HTMLElement>('.sp-landing-plan');
                    if (viewport && card)
                      viewport.scrollTo({
                        left: index * (card.offsetWidth + 16),
                        behavior: 'smooth',
                      });
                  }}
                  type="button"
                />
              ))}
            </div>
            <button
              aria-label="Tarif suivant"
              disabled={pricingIndex === plans.length - 1}
              onClick={() => movePricing(1)}
              type="button"
            >
              ›
            </button>
          </div>
          <p className="sp-landing-pricing-note">
            Facturation annuelle · Les demandes de démo sont soumises à validation.
          </p>
          <div className="sp-landing-comparison">
             <div className="sp-landing-section-heading">
                <h2>
                  Comparez les formules
                  <br />
                  <span>en un coup d’œil.</span>
                </h2>

              </div>
            <div className="sp-landing-comparison-heading">
             
            </div>
            <div className="sp-landing-comparison-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Fonctionnalités</th>
                    {plans.map((plan) => (
                      <th className={plan.featured ? 'sp-compare-featured' : ''} key={plan.name} scope="col">
                        {plan.name === 'PROFESSIONAL' ? 'Professional' : plan.name.charAt(0) + plan.name.slice(1).toLowerCase()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparisonFeatures.map((feature) => (
                    <tr key={feature.label}>
                      <th scope="row">{feature.label}</th>
                      {feature.available.map((included, index) => (
                        <td className={plans[index].featured ? 'sp-compare-featured' : ''} key={plans[index].name}>
                          <span aria-label={included ? 'Inclus' : 'Non inclus'} className={included ? 'sp-compare-check' : 'sp-compare-no'}>
                            {included ? '✓' : '—'}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section className="sp-landing-section sp-landing-section-soft" id="lp-faq">
        <div className="sp-landing-container sp-landing-faq">
          <p className="sp-landing-kicker">FAQ</p>
          <h2>
            Les questions
            <br />
            <span>les plus courantes.</span>
          </h2>
          {questions.map(([question, answer]) => (
            <details key={question}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="sp-landing-section" aria-label="Accès à Madrassa-Ti">
        <div className="sp-landing-container">
          <div className="sp-landing-section-heading">
            <h2>
              Faites de Madrassa-Ti
              <br />
              <span>votre espace de gestion.</span>
            </h2>
            <p className="sp-landing-muted">
              Une plateforme claire pour votre équipe.
            </p>
            <Link
              className="sp-landing-plan-cta"
              style={{ display: 'inline-flex', width: 'auto', marginTop: 20, background: 'transparent', color: 'inherit', border: '1px solid var(--sp-border, #dbe3ef)', boxShadow: 'none' }}
              to="/login"
            >
              Accéder à mon espace →
            </Link>
          </div>
        </div>
      </section>

      <section className="sp-landing-section" id="lp-ct">
        <div className="sp-landing-container sp-landing-contact">
          <div>
            <p className="sp-landing-kicker">CONTACT</p>
            <h2>
              Parlons de votre
              <br />
              <span>centre de formation.</span>
            </h2>
            <p className="sp-landing-muted">
              Une question sur Madrassa-Ti, une demande de démonstration ou un besoin spécifique ?
              Écrivez-nous.
            </p>
            <div className="sp-landing-contact-details">
              <div>
                <b>⌖</b>
                <span>
                  <small>Adresse</small>Votre adresse, Ville, Maroc
                </span>
              </div>
              <div>
                <b>☎</b>
                <span>
                  <small>Téléphone</small>
                  <a href="tel:+212600000000">+212 6 00 00 00 00</a>
                </span>
              </div>
              <div>
                <b>@</b>
                <span>
                  <small>E-mail</small>
                  <a href="mailto:contact@test-formation.ma">contact@test-formation.ma</a>
                </span>
              </div>
              <div>
                <b>◷</b>
                <span>
                  <small>Horaires</small>Lundi – Samedi : 9h – 19h
                </span>
              </div>
            </div>
            <a
              className="sp-landing-whatsapp"
              href="https://wa.me/212600000000"
              rel="noreferrer"
              target="_blank"
            >
              Écrire sur WhatsApp →
            </a>
          </div>
          <form className="sp-landing-contact-form" onSubmit={submitContact}>
            <div className="sp-landing-form-heading">
              <b>Demande d’information</b>
              <span>Réponse rapide</span>
            </div>
            <div className="sp-landing-form-row">
              <label>
                Nom complet
                <input maxLength={60} name="name" placeholder="Votre nom" required />
              </label>
              <label>
                Téléphone
                <input maxLength={20} name="phone" placeholder="+212 ..." type="tel" />
              </label>
            </div>
            <label>
              Sujet
              <select name="subject">
                <option>Démonstration Madrassa-Ti</option>
                <option>Informations générales</option>
                <option>Offre pour mon centre</option>
                <option>Autre</option>
              </select>
            </label>
            <label>
              Message
              <textarea
                maxLength={800}
                name="message"
                placeholder="Décrivez votre besoin..."
                required
                rows={5}
              />
            </label>
            <button className="sp-landing-submit" type="submit">
              Envoyer la demande →
            </button>
            <p>
              {contactMessage ||
                'Votre application de messagerie s’ouvrira avec le message prêt à envoyer.'}
            </p>
          </form>
        </div>
      </section>

      {demoOpen && (
        <div role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setDemoOpen(false); }} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,.68)', display: 'grid', placeItems: 'center', padding: 16, overflowY: 'auto' }}>
          <section aria-labelledby="demo-title" aria-modal="true" role="dialog" style={{ width: 'min(100%, 560px)', maxHeight: '90vh', overflowY: 'auto', background: 'var(--sp-card, #fff)', color: 'var(--sp-text, #172554)', borderRadius: 20, padding: 24, boxShadow: '0 24px 80px rgba(0,0,0,.25)' }}>
            <button type="button" onClick={() => setDemoOpen(false)} aria-label="Fermer" style={{ float: 'right', fontSize: 24, padding: '0 8px' }}>×</button>
            <p className="sp-landing-kicker">DEMANDE DE DÉMO GRATUITE</p>
            <h2 id="demo-title"><b>14 jours · 0 DH</b></h2>
            <form className="sp-landing-contact-form" onSubmit={submitDemo}>
              <label>Nom complet du responsable<input name="contact_name" required minLength={2} maxLength={100} autoComplete="name" placeholder="Votre nom complet" /></label>
              <label>Nom du centre<input name="centre_name" required minLength={2} maxLength={150} placeholder="Nom de votre centre" /></label>
              <label>E-mail<input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="vous@exemple.ma" /></label>
              <label>Téléphone<input name="phone" type="tel" required minLength={6} maxLength={30} autoComplete="tel" placeholder="+212 ..." /></label>
              <button className="sp-landing-submit" disabled={demoSubmitting} type="submit">{demoSubmitting ? 'Envoi en cours…' : 'Envoyer ma demande de démo →'}</button>
              {demoMessage && <p role="status">{demoMessage}</p>}
            </form>
          </section>
        </div>
      )}

      {subscriptionPlan && (
        <div role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setSubscriptionPlan(null); }} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,.68)', display: 'grid', placeItems: 'center', padding: 16, overflowY: 'auto' }}>
          <section aria-labelledby="subscription-title" aria-modal="true" role="dialog" style={{ width: 'min(100%, 560px)', maxHeight: '90vh', overflowY: 'auto', background: 'var(--sp-card, #fff)', color: 'var(--sp-text, #172554)', borderRadius: 20, padding: 24, boxShadow: '0 24px 80px rgba(0,0,0,.25)' }}>
            <button type="button" onClick={() => setSubscriptionPlan(null)} aria-label="Fermer" style={{ float: 'right', fontSize: 24, padding: '0 8px' }}>×</button>
            <p className="sp-landing-kicker">DEMANDE D’ABONNEMENT</p>
            <h2 id="subscription-title">Pack {subscriptionPlan.name}</h2>
            <p style={{ marginBottom: 18, fontWeight: 700 }}>{subscriptionPlan.price} DH / an</p>
            <form className="sp-landing-contact-form" onSubmit={submitSubscription}>
              <label>Nom complet du responsable<input name="contact_name" required minLength={2} maxLength={100} autoComplete="name" placeholder="Votre nom complet" /></label>
              <label>Nom du centre<input name="centre_name" required minLength={2} maxLength={150} placeholder="Nom de votre centre" /></label>
              <label>E-mail<input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="vous@exemple.ma" /></label>
              <label>Téléphone<input name="phone" type="tel" required minLength={6} maxLength={30} autoComplete="tel" placeholder="+212 ..." /></label>
              <div style={{ padding: 14, borderRadius: 12, background: 'var(--sp-soft, #f8fafc)' }}>
                <strong>Pack {subscriptionPlan.name}</strong><br />Abonnement annuel : {subscriptionPlan.price} DH
              </div>
              <button className="sp-landing-submit" disabled={subscriptionSubmitting} type="submit">{subscriptionSubmitting ? 'Envoi en cours…' : 'Demander mon abonnement →'}</button>
              {subscriptionMessage && <p role="status">{subscriptionMessage}</p>}
            </form>
          </section>
        </div>
      )}
      <footer className="sp-landing-footer">
        <Link aria-label="Madrassa-Ti, retour en haut" className="sp-landing-brand" to="/">
          <span className="sp-landing-mark">
            <i />
            <i />
            <i />
          </span>
          <span>
            Madrassa<span>-Ti</span>
          </span>
        </Link>
        <p>La plateforme de gestion pensée pour les centres de formation.</p>
        <nav aria-label="Liens de pied de page">
          <a href="#lp-dom">Formations</a>
          <a href="#lp-pricing">Offres</a>
          <a href="#lp-faq">FAQ</a>
          <a href="#lp-ct">Contact</a>
          <Link to="/login">Connexion</Link>
        </nav>
        <small>© {new Date().getFullYear()} Madrassa-Ti. Tous droits réservés.</small>
      </footer>
    </main>
  );
}
