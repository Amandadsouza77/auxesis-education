// Metadata only: applied after the approved public-copy transformation.
const metadata = {
  'home.html': ['IB Biology & Chemistry Tutoring | Auxesis Education', 'Online one-to-one IB Biology and Chemistry tutoring from an experienced international educator. Individualized teaching and exam prep in Canada and worldwide.'],
  'about-amanda.html': ['Meet Amanda D’Souza | Science Tutor | Auxesis Education', 'Meet Amanda D’Souza, an experienced international science educator and IB Biology examiner offering individualized online tutoring.'],
  'about-auxesis.html': ['About Auxesis | Individualized Science Tutoring', 'Discover the Auxesis approach to one-to-one online science tutoring: active learning, individualized support and independent thinking.'],
  'enquire.html': ['Enquire About Online Science Tutoring | Auxesis Education', 'Enquire about one-to-one online science tutoring. Share the student’s course, needs and goals, and arrange a free Meet & Greet.'],
  'faq.html': ['Science Tutoring FAQs | Auxesis Education', 'Answers to common questions about online science lessons, programmes, time zones, preparation, payments and missed sessions.'],
  'how-tutoring-works.html': ['How Online Tutoring Works | Auxesis Education', 'Learn how to get started with online science tutoring, from your first enquiry and free Meet & Greet to ongoing lessons.'],
  'privacy-consent.html': ['Privacy & Consent | Auxesis Education', 'Learn how Auxesis Education collects and uses information for tutoring and related administration.'],
  'recommendations.html': ['Tutoring Recommendations & Reviews | Auxesis Education', 'Read recommendations from students, parents and colleagues about working with science teacher and tutor Amanda D’Souza.'],
  'subjects-programmes.html': ['IB, A-Level & GCSE Science Tutoring | Auxesis Education', 'Explore online tutoring for IB Biology, Chemistry and ESS, MYP Science, GCSE and IGCSE science, A-Level Biology and Ontario science.'],
  'tutoring-policies.html': ['Tutoring Policies | Auxesis Education', 'Read Auxesis Education policies on payments, cancellations, rescheduling, academic integrity and working together.']
};
const escapeHtml = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
function replaceOnce(html, pattern, replacement, label) {
  const matches = [...html.matchAll(pattern)];
  if (matches.length !== 1) throw Error(`Expected exactly one ${label}, found ${matches.length}`);
  return html.replace(pattern, () => replacement);
}
export function applySeoMetadata(file, html) {
  const data = metadata[file];
  if (!data) throw Error(`No SEO metadata for ${file}`);
  const [title, description] = data;
  html = replaceOnce(html, /<title>[\s\S]*?<\/title>/gi, `<title>${escapeHtml(title)}</title>`, `${file} title`);
  html = replaceOnce(html, /<meta\s+name="description"\s+content="[^"]*"\s*\/?\s*>/gi, `<meta name="description" content="${escapeHtml(description)}">`, `${file} description`);
  if (file === 'home.html') {
    const schema = { '@context':'https://schema.org', '@type':'EducationalOrganization', name:'Auxesis Education', url:'https://auxedu.com/', email:'adsouza35@gmail.com', logo:'https://auxedu.com/assets/logo-header-transparent.svg' };
    if (/application\/ld\+json/i.test(html)) throw Error('Review existing structured data before adding organization schema');
    html = replaceOnce(html, /<\/head>/gi, `<script type="application/ld+json">${JSON.stringify(schema).replaceAll('<','\\u003c')}</script></head>`, 'head close');
  }
  return html;
}
