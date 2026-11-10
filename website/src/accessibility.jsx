import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/sora';
import './site.css';
import BrandLogo from '../../src/common/components/brand/BrandLogo';
import {
  STATEMENT_UPDATED,
  accessibilityStatement,
} from '../../src/common/accessibility/statement';
import { site } from './config';
import { Footer } from './components/Sections';

// A11-07: the accessibility statement of the website, the same text as the app's.
const statement = accessibilityStatement('he');
const contact = site.accessibility || {};
const hasContact = Boolean(contact.name || contact.phone || contact.email);

const Statement = () => (
  <>
    <header className="statement__header">
      <div className="container statement__bar">
        <a href="./" aria-label="viper fleet">
          <BrandLogo height={28} variant="reverse" />
        </a>
      </div>
    </header>
    <main className="container statement">
      <h1>{statement.title}</h1>
      {statement.sections.map((section) => (
        <section key={section.title}>
          <h2>{section.title}</h2>
          {(section.paragraphs || []).map((text) => (
            <p key={text}>{text}</p>
          ))}
          {section.items && (
            <ul>
              {section.items.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          )}
          {section.contact &&
            (hasContact ? (
              <p>
                {contact.name && (
                  <>
                    {statement.coordinator}: {contact.name}
                    <br />
                  </>
                )}
                {contact.phone && (
                  <>
                    {statement.phone}:{' '}
                    <a href={`tel:${contact.phone}`} dir="ltr">
                      {contact.phone}
                    </a>
                    <br />
                  </>
                )}
                {contact.email && (
                  <>
                    {statement.email}:{' '}
                    <a href={`mailto:${contact.email}`} dir="ltr">
                      {contact.email}
                    </a>
                  </>
                )}
              </p>
            ) : (
              <p>{statement.notSet}</p>
            ))}
        </section>
      ))}
      <p className="statement__updated">
        {statement.updated}: {new Date(STATEMENT_UPDATED).toLocaleDateString('he-IL')}
      </p>
    </main>
    <Footer />
  </>
);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Statement />
  </StrictMode>,
);
