import { Link, useLocation } from 'react-router-dom';

type LegalKind = 'privacy' | 'terms' | 'legal';

const pages: Record<LegalKind, { title: string; eyebrow: string; intro: string; sections: { title: string; body: string }[] }> = {
  privacy: {
    title: 'Politique de confidentialité',
    eyebrow: 'VOS DONNÉES, NOTRE RESPONSABILITÉ',
    intro: 'Cette page explique de manière claire quelles informations Madrassa-Ti peut traiter lorsque vous visitez le site ou utilisez la plateforme. Elle doit être complétée et validée par l’éditeur avant publication définitive.',
    sections: [
      { title: '1. Responsable du traitement', body: 'Le responsable du traitement est l’éditeur de Madrassa-Ti. Identité juridique, adresse professionnelle et coordonnées de contact : à compléter par l’éditeur avant mise en ligne.' },
      { title: '2. Données susceptibles d’être traitées', body: 'Selon les fonctionnalités utilisées, les données peuvent inclure les coordonnées saisies dans les demandes de démonstration ou d’abonnement, les informations de compte et de profil, ainsi que les données pédagogiques et administratives ajoutées par les centres (étudiants, formateurs, formations, présences, documents et opérations de gestion).' },
      { title: '3. Finalités et accès', body: 'Les données sont utilisées pour répondre aux demandes, fournir et sécuriser le service, gérer les comptes et les droits d’accès, et assurer le fonctionnement des fonctionnalités choisies par le centre. Les accès doivent être limités aux personnes autorisées selon leur rôle et leur centre.' },
      { title: '4. Hébergement et prestataires', body: 'La plateforme s’appuie notamment sur Supabase pour certaines fonctions de données et d’authentification. L’éditeur doit préciser les prestataires effectivement utilisés, les lieux d’hébergement, les éventuels transferts hors du pays et les garanties applicables.' },
      { title: '5. Durée de conservation', body: 'Les données ne doivent être conservées que pendant la durée nécessaire aux finalités prévues, sous réserve des obligations légales et des besoins légitimes de sécurité ou de preuve. Les durées précises doivent être définies par l’éditeur pour chaque catégorie de données.' },
      { title: '6. Sécurité et confidentialité', body: 'Des mesures techniques et organisationnelles adaptées doivent protéger les données contre les accès non autorisés, la perte, l’altération ou la divulgation. Aucun service en ligne ne peut toutefois garantir une sécurité absolue.' },
      { title: '7. Vos droits et contact', body: 'Pour toute question ou demande concernant vos données, contactez le responsable du traitement via les coordonnées officielles à renseigner ici. Les droits applicables et les modalités d’exercice doivent être confirmés selon la législation en vigueur et la situation de la personne concernée.' },
      { title: '8. Mise à jour', body: 'Cette politique peut être actualisée pour refléter l’évolution du service ou des obligations applicables. La date de dernière mise à jour devra être indiquée après validation.' },
    ],
  },
  terms: {
    title: 'Conditions générales d’utilisation',
    eyebrow: 'LES RÈGLES D’UTILISATION',
    intro: 'Les présentes conditions encadrent l’accès au site public et l’utilisation de Madrassa-Ti. Elles constituent une base de travail à faire vérifier par un professionnel avant leur entrée en vigueur.',
    sections: [
      { title: '1. Objet du service', body: 'Madrassa-Ti est une plateforme destinée à aider les centres de formation à organiser leurs activités administratives et pédagogiques, notamment les étudiants, formateurs, formations, groupes, planning, présences, documents et, selon la formule activée, d’autres modules.' },
      { title: '2. Accès et compte', body: 'L’accès aux espaces privés nécessite un compte et dépend du rôle attribué ainsi que des autorisations du centre. L’utilisateur doit fournir des informations exactes, préserver la confidentialité de ses identifiants et signaler tout accès suspect.' },
      { title: '3. Rôles et responsabilités des centres', body: 'Le centre est responsable de la gestion de ses utilisateurs, de l’attribution des droits et de la licéité des données qu’il importe ou saisit. Il doit informer les personnes concernées lorsque cela est requis et ne collecter que les données nécessaires.' },
      { title: '4. Usage autorisé', body: 'L’utilisateur s’engage à utiliser la plateforme conformément aux lois applicables, à respecter les droits des tiers, à ne pas tenter de contourner les contrôles d’accès, perturber le service ou introduire un contenu malveillant.' },
      { title: '5. Formules, démonstration et paiement', body: 'Les fonctionnalités accessibles dépendent de la formule et des droits activés. Une demande de démonstration ou d’abonnement ne vaut pas activation automatique : elle peut nécessiter une validation. Les prix, taxes éventuelles, modalités de paiement, renouvellement, résiliation et remboursement doivent être précisés dans l’offre contractuelle applicable.' },
      { title: '6. Données et sauvegardes', body: 'Le centre reste responsable de l’exactitude et de la pertinence des informations qu’il saisit. Il lui appartient de vérifier les exports et documents produits et de conserver les sauvegardes nécessaires à son activité. Les modalités de réversibilité et de suppression doivent être précisées contractuellement.' },
      { title: '7. Disponibilité et évolution', body: 'L’éditeur s’efforce de maintenir le service disponible et de le faire évoluer, sans garantir une disponibilité ininterrompue. Des opérations de maintenance, incidents techniques ou dépendances à des prestataires peuvent temporairement affecter certaines fonctions.' },
      { title: '8. Propriété intellectuelle', body: 'Sauf mention contraire, les éléments du site et de la plateforme sont protégés par les règles applicables de propriété intellectuelle. L’accès au service n’emporte aucun transfert de propriété sur ces éléments.' },
      { title: '9. Suspension et fin d’accès', body: 'L’accès peut être limité ou suspendu en cas de risque de sécurité, d’usage illicite ou de non-respect des conditions applicables, dans les limites prévues par le contrat et la loi. Les conséquences sur les données doivent être définies dans les conditions contractuelles finales.' },
      { title: '10. Droit applicable et contact', body: 'Le droit applicable, la juridiction compétente et les coordonnées de l’éditeur doivent être confirmés et renseignés avant publication définitive. Les dispositions impératives applicables aux utilisateurs demeurent réservées.' },
    ],
  },
  legal: {
    title: 'Mentions légales',
    eyebrow: 'INFORMATIONS SUR L’ÉDITEUR',
    intro: 'Les informations ci-dessous identifient l’éditeur et les prestataires du site. Les champs indiqués « à compléter » sont indispensables à renseigner avec des informations exactes avant publication.',
    sections: [
      { title: 'Éditeur du site', body: 'Nom commercial : Madrassa-Ti.\nRaison sociale / nom complet de l’éditeur : à compléter.\nForme juridique : à compléter.\nAdresse du siège ou adresse professionnelle : à compléter.\nIdentifiants d’immatriculation et fiscaux, le cas échéant : à compléter.\nE-mail de contact officiel : à compléter.\nTéléphone professionnel : à compléter.' },
      { title: 'Directeur de la publication', body: 'Nom et qualité du directeur de la publication : à compléter par l’éditeur.' },
      { title: 'Hébergement', body: 'Hébergeur du site web : à compléter avec le nom légal, l’adresse et les coordonnées de l’hébergeur réellement utilisé. Les prestataires techniques de données et d’authentification doivent être indiqués séparément lorsque nécessaire.' },
      { title: 'Propriété intellectuelle', body: 'Le nom, l’identité visuelle, les textes, les interfaces et les éléments logiciels de Madrassa-Ti peuvent être protégés par les droits applicables. Toute reproduction ou réutilisation non autorisée est interdite dans les limites prévues par la loi.' },
      { title: 'Responsabilité', body: 'Les informations du site sont fournies à titre descriptif. L’éditeur doit compléter cette mention en fonction des caractéristiques réelles du service et des règles applicables ; elle ne limite pas les responsabilités qui ne peuvent légalement être exclues.' },
      { title: 'Données personnelles et cookies', body: 'Pour les informations relatives au traitement des données personnelles, consultez la Politique de confidentialité. Les cookies et traceurs réellement utilisés, leurs finalités et les choix offerts aux visiteurs doivent être documentés avant publication.' },
    ],
  },
};

export function LegalPage() {
  const location = useLocation();
  const kind: LegalKind = location.pathname.endsWith('/politique-confidentialite')
    ? 'privacy'
    : location.pathname.endsWith('/conditions-generales-utilisation')
      ? 'terms'
      : 'legal';
  const page = pages[kind];

  return (
    <main className="sp-legal-page">
      <style>{`
        .sp-legal-page{min-height:100vh;background:linear-gradient(180deg,#eff6ff 0,#f8fafc 340px,#fff 100%);color:#172554;padding:0 20px 64px}
        .sp-legal-nav{max-width:1040px;margin:0 auto;padding:24px 0;display:flex;align-items:center;justify-content:space-between;gap:16px}
        .sp-legal-brand{font-weight:850;font-size:1.2rem;letter-spacing:-.04em;color:#172554;text-decoration:none}
        .sp-legal-home{color:#1d4ed8;text-decoration:none;font-weight:700;font-size:.92rem}
        .sp-legal-hero{max-width:1040px;margin:32px auto 24px;padding:clamp(28px,5vw,52px);border-radius:28px;background:linear-gradient(115deg,#020617 0%,#172554 48%,#1e40af 100%);color:#fff;box-shadow:0 24px 60px -35px rgba(30,64,175,.65)}
        .sp-legal-eyebrow{font-size:.74rem;font-weight:800;letter-spacing:.16em;color:#93c5fd}
        .sp-legal-hero h1{margin:14px 0;font-size:clamp(2rem,5vw,3.5rem);line-height:1.08;letter-spacing:-.05em}
        .sp-legal-hero p{max-width:760px;margin:0;color:#dbeafe;line-height:1.8}
        .sp-legal-content{max-width:900px;margin:0 auto;display:grid;gap:16px}
        .sp-legal-section{padding:clamp(20px,3vw,30px);background:#fff;border:1px solid #dbeafe;border-radius:18px;box-shadow:0 10px 30px -28px rgba(15,23,42,.35)}
        .sp-legal-section h2{margin:0 0 12px;color:#1e3a8a;font-size:1.08rem;font-weight:800}
        .sp-legal-section p{margin:0;color:#475569;line-height:1.85;white-space:pre-line}
        .sp-legal-notice{max-width:900px;margin:22px auto 0;padding:16px 18px;border:1px solid #bfdbfe;border-radius:14px;background:#eff6ff;color:#1e40af;font-size:.9rem;line-height:1.7}
        .sp-legal-footer{max-width:1040px;margin:38px auto 0;padding-top:22px;border-top:1px solid #dbeafe;display:flex;flex-wrap:wrap;gap:12px 22px;color:#64748b;font-size:.88rem}
        .sp-legal-footer a{color:#1d4ed8;text-decoration:none;font-weight:650}
        .sp-legal-footer a:hover{text-decoration:underline}
      `}</style>
      <header className="sp-legal-nav">
        <Link className="sp-legal-brand" to="/">Madrassa-Ti</Link>
        <Link className="sp-legal-home" to="/">← Retour au site</Link>
      </header>
      <section className="sp-legal-hero">
        <span className="sp-legal-eyebrow">{page.eyebrow}</span>
        <h1>{page.title}</h1>
        <p>{page.intro}</p>
      </section>
      <div className="sp-legal-content">
        {page.sections.map((section) => (
          <section className="sp-legal-section" key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </section>
        ))}
      </div>
      <p className="sp-legal-notice">
        Important : ces textes constituent une base éditoriale et ne remplacent pas une validation juridique. Les informations d’identité, d’hébergement, de contact et les modalités réelles de traitement doivent être complétées avant la mise en production.
      </p>
      <footer className="sp-legal-footer">
        <span>© {new Date().getFullYear()} Madrassa-Ti</span>
        <Link to="/politique-confidentialite">Politique de confidentialité</Link>
        <Link to="/conditions-generales-utilisation">Conditions générales d’utilisation</Link>
        <Link to="/mentions-legales">Mentions légales</Link>
        <Link to="/">Accueil</Link>
      </footer>
    </main>
  );
}
