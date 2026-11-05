import Nav from './components/Nav';
import Hero from './components/Hero';
import Journey from './components/journey/Journey';
import Showcase from './components/Showcase';
import Features from './components/Features';
import { Contact, Faq, Footer, Mobile, Numbers, Steps } from './components/Sections';
import { useRevealAll } from './lib/hooks';

const App = () => {
  useRevealAll();
  return (
    <>
      <a className="skip" href="#journey">
        דלגו לתוכן
      </a>
      <Nav />
      <main>
        <Hero />
        <Journey />
        <Showcase />
        <Features />
        <Numbers />
        <Steps />
        <Mobile />
        <Faq />
        <Contact />
      </main>
      <Footer />
    </>
  );
};

export default App;
