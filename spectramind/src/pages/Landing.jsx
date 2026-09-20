import Navbar from "../components/layout/Navbar";
import Hero from "../components/landing/Hero";
import Features from "../components/landing/Features";
import WhyCompvd from "../components/landing/WhyCompvd";
import DashboardPreview from "../components/landing/DashboardPreview";
import ContactSection from "../components/landing/ContactSection";
import Footer from "../components/Footer";

export default function Landing() {
  return (
    <div
      id="top"
      className="min-h-screen bg-transparent text-slate-900"
    >

      <Navbar />

      <Hero />

      <Features />

      <WhyCompvd />

      <DashboardPreview />

      <ContactSection />

      <Footer />

    </div>
  );
}
