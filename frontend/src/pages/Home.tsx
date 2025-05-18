import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const Home: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState<boolean>(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled ? 'bg-white shadow-md' : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-purple-600">Ontora AI</h1>
          <nav className="hidden md:flex space-x-6">
            <button
              onClick={() => scrollToSection('features')}
              className="text-gray-700 hover:text-purple-500 transition-colors"
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection('about')}
              className="text-gray-700 hover:text-purple-500 transition-colors"
            >
              About
            </button>
            <Link
              to="/onboarding"
              className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 transition-colors"
            >
              Get Started
            </Link>
          </nav>
          <div className="md:hidden">
            <button className="text-gray-700 hover:text-purple-500">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="pt-20 pb-12">
        <section className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Build Autonomous AI Agents on Solana with Ontora AI
            </h2>
            <p className="text-lg md:text-xl max-w-3xl mx-auto mb-8">
              Empower your Web3 journey by creating and evolving AI agents tailored to your needs,
              all on the fast and scalable Solana blockchain.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link
                to="/onboarding"
                className="px-6 py-3 bg-white text-purple-600 font-medium rounded-md hover:bg-gray-100 transition-colors text-lg"
              >
                Get Started
              </Link>
              <button
                onClick={() => scrollToSection('features')}
                className="px-6 py-3 bg-transparent border-2 border-white text-white font-medium rounded-md hover:bg-white hover:bg-opacity-10 transition-colors text-lg"
              >
                Learn More
              </button>
            </div>
          </div>
        </section>

        <section id="features" className="py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-gray-800 text-center mb-12">Key Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="p-6 bg-white shadow-md rounded-lg border border-gray-200">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 text-purple-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Custom AI Agents</h3>
                <p className="text-gray-600">
                  Design and deploy AI agents that adapt to your Web3 habits and evolve over time
                  with unique story chapters.
                </p>
              </div>
              <div className="p-6 bg-white shadow-md rounded-lg border border-gray-200">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 text-purple-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Solana Integration</h3>
                <p className="text-gray-600">
                  Leverage the speed and scalability of Solana for secure, decentralized AI agent
                  operations.
                </p>
              </div>
              <div className="p-6 bg-white shadow-md rounded-lg border border-gray-200">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 text-purple-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Community-Driven</h3>
                <p className="text-gray-600">
                  Join a vibrant community to share, customize, and evolve AI agents together on
                  the Web3 frontier.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="about" className="py-16 bg-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="lg:flex lg:items-center lg:space-x-12">
              <div className="lg:w-1/2">
                <h2 className="text-3xl font-bold text-gray-800 mb-6">About Ontora AI</h2>
                <p className="text-gray-600 mb-4">
                  Ontora AI is a pioneering platform on the Solana blockchain, enabling Web3 users
                  to build and manage autonomous AI agent swarms. Each agent evolves through user
                  interactions and local deployment, creating unique narratives and chapters.
                </p>
                <p className="text-gray-600 mb-6">
                  Our mission is to democratize AI in the decentralized world, empowering users to
                  harness intelligent agents for trading, governance, NFTs, and beyond.
                </p>
                <button
                  onClick={() => scrollToSection('contact')}
                  className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 transition-colors"
                >
                  Contact Us
                </button>
              </div>
              <div className="mt-10 lg:mt-0 lg:w-1/2">
                <img
                  src="https://via.placeholder.com/600x400?text=Ontora+AI+Vision"
                  alt="Ontora AI Vision"
                  className="rounded-lg shadow-md w-full"
                />
              </div>
            </div>
          </div>
        </section>

        <section id="contact" className="py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold text-gray-800 mb-6">Get in Touch</h2>
            <p className="text-gray-600 max-w-2xl mx-auto mb-8">
              Have questions or want to join our community? Reach out to us or explore our
              onboarding resources to start building your AI agents today.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link
                to="/onboarding"
                className="px-6 py-3 bg-purple-500 text-white font-medium rounded-md hover:bg-purple-600 transition-colors text-lg"
              >
                Start Onboarding
              </Link>
              <Link
                to="/docs"
                className="px-6 py-3 bg-gray-200 text-gray-800 font-medium rounded-md hover:bg-gray-300 transition-colors text-lg"
              >
                View Documentation
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-gray-800 text-white py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="text-xl font-bold mb-4">Ontora AI</h3>
              <p className="text-gray-400">
                Building the future of autonomous AI agents on the Solana blockchain.
              </p>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Resources</h4>
              <ul className="space-y-2">
                <li>
                  <Link to="/docs" className="text-gray-400 hover:text-white transition-colors">
                    Documentation
                  </Link>
                </li>
                <li>
                  <Link
                    to="/onboarding"
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    Onboarding
                  </Link>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    Tutorials
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Community</h4>
              <ul className="space-y-2">
                <li>
                  <a
                    href="#"
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    Discord
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    Twitter
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    GitHub
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Legal</h4>
              <ul className="space-y-2">
                <li>
                  <a
                    href="#"
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    Privacy Policy
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-700 pt-6 text-center text-gray-400">
            <p>© 2023 Ontora AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
