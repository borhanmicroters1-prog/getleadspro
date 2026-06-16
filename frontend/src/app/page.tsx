"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { auth } from "@/utils/auth";
import { useRouter } from "next/navigation";
import "./landing.css";

export default function LandingPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  useEffect(() => {
    setIsLoggedIn(auth.isAuthenticated());
  }, []);

  const toggleFaq = (index: number) => {
    if (faqOpen === index) {
      setFaqOpen(null);
    } else {
      setFaqOpen(index);
    }
  };

  const faqs = [
    {
      q: "What is a lead credit?",
      a: "A lead credit allows you to scrape and unlock 1 unique business contact (containing business name, phone, email, website, social links, etc.) from our Google Maps or FB Ads scrapers. 1 credit = 1 lead."
    },
    {
      q: "Do credits expire?",
      a: "No! Your purchased credits never expire. You can use them whenever you need, whether it's today, next month, or next year."
    },
    {
      q: "What data do I get with each lead?",
      a: "You get the business name, phone number, email address (if publicly available), website URL, social media profiles (Facebook, Instagram, LinkedIn), Google rating, review count, address, and active Facebook ad status."
    },
    {
      q: "Can I send emails directly from GetLeads?",
      a: "Yes! GetLeads features a built-in cold email campaign automation tool. You can connect your SMTP, Gmail, or Outlook accounts and send automated drip sequences with follow-ups and click/open tracking."
    },
    {
      q: "Which countries and regions are covered?",
      a: "While we specialize in localized scraper optimizations for Bangladesh (Dhaka, Chittagong, Sylhet, etc.), our Google Maps and Facebook Ads Library scrapers have 100% global coverage. You can search any city in any country."
    }
  ];

  return (
    <div className="landing-page">

      <div className="min-h-screen flex flex-col bg-white font-sans">
        
        {/* Navigation Bar */}
        <nav className="border-b px-6 py-3.5 sticky top-0 bg-white/95 backdrop-blur z-50 shadow-sm">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center font-bold text-white text-base shadow-sm">
                GL
              </div>
              <span className="text-xl font-extrabold text-slate-900 tracking-tight">
                Get<span className="text-emerald-500">Leads</span>
              </span>
            </div>
            
            <div className="hidden md:flex items-center gap-8 text-sm text-slate-600 font-medium">
              <a href="#features" className="hover:text-slate-900 transition">
                Features
              </a>
              <a href="#how-it-works" className="hover:text-slate-900 transition">
                How it works
              </a>
              <a href="#pricing" className="hover:text-slate-900 transition">
                Pricing
              </a>
              <a href="#faq" className="hover:text-slate-900 transition">
                FAQ
              </a>
            </div>

            <div className="flex items-center gap-3">
              {isLoggedIn ? (
                <Link href="/dashboard">
                  <button className="inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring h-9 rounded-md px-4 text-xs bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm">
                    Go to Dashboard
                  </button>
                </Link>
              ) : (
                <>
                  <Link href="/login">
                    <button className="inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring h-8 rounded-md px-3 text-xs text-slate-600 hover:bg-slate-50">
                      Log in
                    </button>
                  </Link>
                  <Link href="/login">
                    <button className="inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring h-8 rounded-md px-3 text-xs bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm">
                      Sign up free
                    </button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-white to-emerald-50/40 pt-20 pb-28 px-4">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-emerald-100/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-100/30 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3 pointer-events-none"></div>
          
          <div className="relative max-w-4xl mx-auto text-center space-y-7">
            <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold px-4 py-1.5 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-zap w-3.5 h-3.5">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              #1 Global Lead Generation Platform
            </div>
            
            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.1]">
              Generate High-Quality Leads <br />
              from Bangladesh
            </h1>
            
            <p className="text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
              Extract business data from Google Maps & Facebook Ads Library — powered by APIFY. Find local prospects with verified phone, email, address, and more.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Link href="/login">
                <button className="inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-md gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-8 h-12 text-base shadow-lg shadow-emerald-200">
                  Get Started Free
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-right w-4 h-4">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </Link>
              <a href="#how-it-works">
                <button className="inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground rounded-md px-8 h-12 text-base gap-2">
                  See how it works
                </button>
              </a>
            </div>
            
            <p className="text-xs text-slate-400">
              No credit card required · Free to get started
            </p>
          </div>

          {/* Interactive Browser Mockup */}
          <div className="relative max-w-5xl mx-auto mt-14">
            <div className="rounded-2xl border border-slate-200 shadow-2xl shadow-slate-200/60 overflow-hidden bg-white">
              <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-100">
                <span className="w-3 h-3 rounded-full bg-red-400"></span>
                <span className="w-3 h-3 rounded-full bg-amber-400"></span>
                <span className="w-3 h-3 rounded-full bg-emerald-400"></span>
                <span className="ml-3 flex-1 bg-white border border-slate-200 rounded-md px-3 py-1 text-xs text-slate-400 max-w-[200px] text-center">
                  getleads.pro/g-maps
                </span>
              </div>
              
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 md:p-8 flex flex-col gap-5">
                <div className="flex items-center gap-3 max-w-xl mx-auto w-full bg-slate-700/60 border border-slate-600/50 rounded-xl px-4 py-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-search w-4 h-4 text-slate-400 shrink-0">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <span className="text-slate-300 text-sm flex-1 text-left">
                    software agency dhaka
                  </span>
                  <span className="bg-emerald-500 text-white text-xs px-3 py-1 rounded-lg font-medium cursor-default">
                    Scrape
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 md:gap-4 w-full max-w-2xl mx-auto">
                  <div className="bg-slate-700/60 rounded-xl p-3 md:p-4 border border-slate-600/50 text-left">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center mb-3">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-map-pin w-4 h-4 text-emerald-400">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    </div>
                    <div className="text-xl md:text-2xl font-bold text-white">15,000+</div>
                    <div className="text-xs text-slate-400 mt-0.5">Leads Found</div>
                  </div>
                  
                  <div className="bg-slate-700/60 rounded-xl p-3 md:p-4 border border-slate-600/50 text-left">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center mb-3">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-megaphone w-4 h-4 text-blue-400">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                      </svg>
                    </div>
                    <div className="text-xl md:text-2xl font-bold text-white">10,000+</div>
                    <div className="text-xs text-slate-400 mt-0.5">Ads Analyzed</div>
                  </div>

                  <div className="bg-slate-700/60 rounded-xl p-3 md:p-4 border border-slate-600/50 text-left">
                    <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center mb-3">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-mail w-4 h-4 text-violet-400">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                      </svg>
                    </div>
                    <div className="text-xl md:text-2xl font-bold text-white">500+</div>
                    <div className="text-xs text-slate-400 mt-0.5">Emails Sent Today</div>
                  </div>
                </div>

                {/* Scraped Results Mock */}
                <div className="w-full max-w-2xl mx-auto space-y-2 text-left">
                  <div className="flex items-center gap-3 bg-slate-700/40 rounded-lg px-3 py-2 border border-slate-700/50">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-map-pin w-3 h-3 text-emerald-400">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    </div>
                    <span className="text-xs font-medium text-white flex-1 truncate">
                      Dhaka Dine Restaurant
                    </span>
                    <span className="text-xs text-slate-400 hidden sm:block">
                      +880 2-555-0101
                    </span>
                    <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-medium">
                      Dhaka
                    </span>
                  </div>

                  <div className="flex items-center gap-3 bg-slate-700/40 rounded-lg px-3 py-2 border border-slate-700/50">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-map-pin w-3 h-3 text-emerald-400">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    </div>
                    <span className="text-xs font-medium text-white flex-1 truncate">
                      Chittagong Shipping Agency
                    </span>
                    <span className="text-xs text-slate-400 hidden sm:block">
                      +880 31-555-0199
                    </span>
                    <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-medium">
                      Chittagong
                    </span>
                  </div>

                  <div className="flex items-center gap-3 bg-slate-700/40 rounded-lg px-3 py-2 border border-slate-700/50">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-map-pin w-3 h-3 text-emerald-400">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    </div>
                    <span className="text-xs font-medium text-white flex-1 truncate">
                      Sylhet Tea Traders
                    </span>
                    <span className="text-xs text-slate-400 hidden sm:block">
                      +880 821-555-0155
                    </span>
                    <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-medium">
                      Sylhet
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* The Challenge Section */}
        <section className="py-24 px-4 bg-white">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14 space-y-3">
              <p className="text-rose-600 text-sm font-semibold uppercase tracking-wider">
                The challenge
              </p>
              <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900">
                Lead generation used to be a grind
              </h2>
              <p className="text-slate-500 text-lg max-w-xl mx-auto">
                The old way wastes hours every day. GetLeads automates the whole process.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              {/* Without GetLeads */}
              <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-8 text-left">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-circle-x w-4 h-4 text-rose-500">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                      <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                  </div>
                  <h3 className="font-bold text-slate-900">Without GetLeads</h3>
                </div>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3 text-sm text-slate-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-circle-x w-4 h-4 text-rose-400 mt-0.5 shrink-0">
                      <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                    Manually searching Google Maps or ads libraries for hours
                  </li>
                  <li className="flex items-start gap-3 text-sm text-slate-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-circle-x w-4 h-4 text-rose-400 mt-0.5 shrink-0">
                      <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                    Copy-pasting phone numbers into spreadsheets
                  </li>
                  <li className="flex items-start gap-3 text-sm text-slate-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-circle-x w-4 h-4 text-rose-400 mt-0.5 shrink-0">
                      <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                    No way to find emails or websites in bulk
                  </li>
                  <li className="flex items-start gap-3 text-sm text-slate-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-circle-x w-4 h-4 text-rose-400 mt-0.5 shrink-0">
                      <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                    Cold calls with no context about the business
                  </li>
                  <li className="flex items-start gap-3 text-sm text-slate-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-circle-x w-4 h-4 text-rose-400 mt-0.5 shrink-0">
                      <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                    Zero tracking — no idea if outreach emails were even opened
                  </li>
                </ul>
              </div>

              {/* With GetLeads */}
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-8 text-left">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-circle-check w-4 h-4 text-emerald-600">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="9 11 12 14 22 4" />
                    </svg>
                  </div>
                  <h3 className="font-bold text-slate-900">With GetLeads</h3>
                </div>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3 text-sm text-slate-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-circle-check w-4 h-4 text-emerald-500 mt-0.5 shrink-0">
                      <circle cx="12" cy="12" r="10" /><polyline points="9 11 12 14 22 4" />
                    </svg>
                    Scrape hundreds of local leads in seconds — any city
                  </li>
                  <li className="flex items-start gap-3 text-sm text-slate-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-circle-check w-4 h-4 text-emerald-500 mt-0.5 shrink-0">
                      <circle cx="12" cy="12" r="10" /><polyline points="9 11 12 14 22 4" />
                    </svg>
                    Get phone numbers, emails, and address instantly
                  </li>
                  <li className="flex items-start gap-3 text-sm text-slate-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-circle-check w-4 h-4 text-emerald-500 mt-0.5 shrink-0">
                      <circle cx="12" cy="12" r="10" /><polyline points="9 11 12 14 22 4" />
                    </svg>
                    Find the most active advertisers via Facebook Ads Library
                  </li>
                  <li className="flex items-start gap-3 text-sm text-slate-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-circle-check w-4 h-4 text-emerald-500 mt-0.5 shrink-0">
                      <circle cx="12" cy="12" r="10" /><polyline points="9 11 12 14 22 4" />
                    </svg>
                    Send automated cold email sequences with templates
                  </li>
                  <li className="flex items-start gap-3 text-sm text-slate-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-circle-check w-4 h-4 text-emerald-500 mt-0.5 shrink-0">
                      <circle cx="12" cy="12" r="10" /><polyline points="9 11 12 14 22 4" />
                    </svg>
                    Track email opens, clicks and replies automatically
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* All-in-One Platform Section */}
        <section id="features" className="py-24 px-4 bg-slate-50">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14 space-y-3">
              <p className="text-emerald-600 text-sm font-semibold uppercase tracking-wider">
                All-in-one platform
              </p>
              <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900">
                Everything you need to win more clients
              </h2>
              <p className="text-slate-500 text-lg max-w-xl mx-auto">
                Find leads, enrich data, send campaigns, and track results — all from one dashboard.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Card 1 */}
              <div className="group rounded-2xl border border-slate-100 bg-white hover:border-slate-200 hover:shadow-lg transition-all duration-200 p-6 text-left">
                <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-map-pin w-5 h-5">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                  </svg>
                </div>
                <h3 className="font-bold text-slate-900 mb-2">Google Maps Scraper</h3>
                <p className="text-sm text-slate-500 mb-4 leading-relaxed">
                  Search any local industry and city. Instantly gather emails, phone numbers, and addresses.
                </p>
                <ul className="space-y-1.5">
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-500"><polyline points="20 6 9 17 4 12"/></svg>
                    Any city, any country
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-500"><polyline points="20 6 9 17 4 12"/></svg>
                    Phone, email, website
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-500"><polyline points="20 6 9 17 4 12"/></svg>
                    Instant CSV export
                  </li>
                </ul>
              </div>

              {/* Card 2 */}
              <div className="group rounded-2xl border border-slate-100 bg-white hover:border-slate-200 hover:shadow-lg transition-all duration-200 p-6 text-left">
                <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-megaphone w-5 h-5">
                    <path d="m3 11 18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
                  </svg>
                </div>
                <h3 className="font-bold text-slate-900 mb-2">Facebook Ads Scraper</h3>
                <p className="text-sm text-slate-500 mb-4 leading-relaxed">
                  Extract businesses actively running social ads — the highest-intent clients in the market.
                </p>
                <ul className="space-y-1.5">
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-blue-500"><polyline points="20 6 9 17 4 12"/></svg>
                    Active ad campaigns
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-blue-500"><polyline points="20 6 9 17 4 12"/></svg>
                    Highest-intent prospects
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-blue-500"><polyline points="20 6 9 17 4 12"/></svg>
                    Filter by category
                  </li>
                </ul>
              </div>

              {/* Card 3 */}
              <div className="group rounded-2xl border border-slate-100 bg-white hover:border-slate-200 hover:shadow-lg transition-all duration-200 p-6 text-left">
                <div className="w-11 h-11 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-mail w-5 h-5">
                    <rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.99 5.73a2 2 0 0 1-2.02 0L2 7" />
                  </svg>
                </div>
                <h3 className="font-bold text-slate-900 mb-2">Email Campaign Builder</h3>
                <p className="text-sm text-slate-500 mb-4 leading-relaxed">
                  Send drip campaigns with IF/ELSE flow steps. Follow ups send automatically while you sleep.
                </p>
                <ul className="space-y-1.5">
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-violet-500"><polyline points="20 6 9 17 4 12"/></svg>
                    Drip sequences
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-violet-500"><polyline points="20 6 9 17 4 12"/></svg>
                    Open/click branching
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-violet-500"><polyline points="20 6 9 17 4 12"/></svg>
                    Daily sending limits
                  </li>
                </ul>
              </div>

              {/* Card 4 */}
              <div className="group rounded-2xl border border-slate-100 bg-white hover:border-slate-200 hover:shadow-lg transition-all duration-200 p-6 text-left">
                <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-database w-5 h-5">
                    <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
                  </svg>
                </div>
                <h3 className="font-bold text-slate-900 mb-2">Lead Database</h3>
                <p className="text-sm text-slate-500 mb-4 leading-relaxed">
                  All your scraped leads in one clean location. Filter, search, and manage leads without limits.
                </p>
                <ul className="space-y-1.5">
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-amber-500"><polyline points="20 6 9 17 4 12"/></svg>
                    All sources in one CRM
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-amber-500"><polyline points="20 6 9 17 4 12"/></svg>
                    Smart location filters
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-amber-500"><polyline points="20 6 9 17 4 12"/></svg>
                    Status tracking
                  </li>
                </ul>
              </div>

              {/* Card 5 */}
              <div className="group rounded-2xl border border-slate-100 bg-white hover:border-slate-200 hover:shadow-lg transition-all duration-200 p-6 text-left">
                <div className="w-11 h-11 rounded-xl bg-pink-100 text-pink-600 flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chart-column w-5 h-5">
                    <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /><line x1="3" y1="20" x2="21" y2="20" />
                  </svg>
                </div>
                <h3 className="font-bold text-slate-900 mb-2">Campaign Analytics</h3>
                <p className="text-sm text-slate-500 mb-4 leading-relaxed">
                  Analyze opens, clicks, and bounces step by step in real time for every connected account.
                </p>
                <ul className="space-y-1.5">
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-pink-500"><polyline points="20 6 9 17 4 12"/></svg>
                    Per-step open metrics
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-pink-500"><polyline points="20 6 9 17 4 12"/></svg>
                    Bounce-back monitoring
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-pink-500"><polyline points="20 6 9 17 4 12"/></svg>
                    Replies breakdown
                  </li>
                </ul>
              </div>

              {/* Card 6 */}
              <div className="group rounded-2xl border border-slate-100 bg-white hover:border-slate-200 hover:shadow-lg transition-all duration-200 p-6 text-left">
                <div className="w-11 h-11 rounded-xl bg-teal-100 text-teal-600 flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-download w-5 h-5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </div>
                <h3 className="font-bold text-slate-900 mb-2">Export & Use Instantly</h3>
                <p className="text-sm text-slate-500 mb-4 leading-relaxed">
                  Download leads list cleanly structured as a CSV. Connect directly to Excel or any external CRM.
                </p>
                <ul className="space-y-1.5">
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-teal-500"><polyline points="20 6 9 17 4 12"/></svg>
                    One-click CSV download
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-teal-500"><polyline points="20 6 9 17 4 12"/></svg>
                    Clean formatting columns
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-teal-500"><polyline points="20 6 9 17 4 12"/></svg>
                    No limits on downloads
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Showcase Split 1: G-Maps */}
        <section className="py-24 px-4 bg-white border-b border-slate-100">
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-5 text-left">
              <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-emerald-200">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-map-pin w-3.5 h-3.5">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                </svg>
                Google Maps Scraper
              </div>
              <h2 className="text-3xl font-extrabold text-slate-900 leading-snug">
                Find every business in any city in seconds
              </h2>
              <p className="text-slate-500 leading-relaxed">
                Search by keyword + city name and instantly scrape raw business profiles. Covers any region, district, or city globally.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 text-sm text-slate-600">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center mt-0.5 shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-600 w-3.5 h-3.5"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>
                  </div>
                  Search local niches: <b>"AC repair Dhaka"</b>, <b>"restaurant Sylhet"</b>
                </li>
                <li className="flex items-start gap-3 text-sm text-slate-600">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center mt-0.5 shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-600 w-3.5 h-3.5"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>
                  </div>
                  Scrape numbers, public email addresses, and websites instantly
                </li>
                <li className="flex items-start gap-3 text-sm text-slate-600">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center mt-0.5 shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-600 w-3.5 h-3.5"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>
                  </div>
                  Filter business category, reviews, and active status
                </li>
              </ul>
              <Link href="/login">
                <button className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring shadow h-9 px-4 py-2 gap-2 bg-emerald-500 hover:bg-emerald-600 text-white mt-2">
                  Try it free
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </button>
              </Link>
            </div>
            
            {/* Right Side Mockup */}
            <div className="rounded-2xl border border-slate-200 bg-slate-900 shadow-xl overflow-hidden text-left">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 border-b border-slate-700">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400/70"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70"></span>
                <span className="ml-2 text-xs text-slate-500">Google Maps Leads</span>
              </div>
              <div className="p-5 space-y-2.5">
                <div className="flex items-center gap-3 bg-slate-800 rounded-lg px-3 py-2.5 border border-slate-700/50">
                  <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-400 w-3.5 h-3.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white truncate">Kacchi Bhai Dhaka</div>
                    <div className="text-[11px] text-slate-400">+880 1711-223344</div>
                  </div>
                  <div className="hidden sm:block text-[11px] text-slate-400 truncate max-w-[110px]">kacchibhai@gmail.com</div>
                </div>

                <div className="flex items-center gap-3 bg-slate-800 rounded-lg px-3 py-2.5 border border-slate-700/50">
                  <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-400 w-3.5 h-3.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white truncate">Grand Sylhet Hotel</div>
                    <div className="text-[11px] text-slate-400">+880 1812-345678</div>
                  </div>
                  <div className="hidden sm:block text-[11px] text-slate-400 truncate max-w-[110px]">info@grandsylhet.com</div>
                </div>

                <div className="flex items-center gap-3 bg-slate-800 rounded-lg px-3 py-2.5 border border-slate-700/50">
                  <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-400 w-3.5 h-3.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white truncate">Chittagong Shipping</div>
                    <div className="text-[11px] text-slate-400">+880 1913-987654</div>
                  </div>
                  <div className="hidden sm:block text-[11px] text-slate-400 truncate max-w-[110px]">support@ctgship.com</div>
                </div>
                
                <div className="pt-1 text-center">
                  <span className="text-xs text-slate-500">+ 245 more results...</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Showcase Split 2: Campaigns */}
        <section className="py-24 px-4 bg-slate-50 border-b border-slate-100">
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-center">
            {/* Left Side Mockup */}
            <div className="order-2 md:order-1 rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden text-left">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-violet-600 w-4 h-4"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.99 5.73a2 2 0 0 1-2.02 0L2 7" /></svg>
                  <span className="font-semibold text-sm text-slate-800">Campaign — Local Scraped Leads</span>
                </div>
                <span className="bg-violet-100 text-violet-700 text-xs px-2 py-0.5 rounded-full font-medium">Active</span>
              </div>
              <div className="p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-emerald-100 text-emerald-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-medium text-slate-800">Step 1: Introduction Draft</div>
                    <div className="text-[11px] text-slate-400">Day 0 · Sent to 300</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-slate-100 text-slate-500">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-medium text-slate-800">Wait 3 days</div>
                    <div className="text-[11px] text-slate-400">Delay Duration</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-blue-100 text-blue-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-medium text-slate-800">IF opened → Follow-up sequence</div>
                    <div className="text-[11px] text-slate-400">Day 3 · Sent to 110</div>
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-3 gap-2">
                  <div className="bg-slate-50 rounded-lg p-2.5 text-center border border-slate-100">
                    <div className="text-sm font-bold text-slate-900">99.1%</div>
                    <div className="text-[10px] text-slate-400">Delivered</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2.5 text-center border border-slate-100">
                    <div className="text-sm font-bold text-slate-900">38.4%</div>
                    <div className="text-[10px] text-slate-400">Opened</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2.5 text-center border border-slate-100">
                    <div className="text-sm font-bold text-slate-900">14.6%</div>
                    <div className="text-[10px] text-slate-400">Replied</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side Description */}
            <div className="order-1 md:order-2 space-y-5 text-left">
              <div className="inline-flex items-center gap-2 bg-violet-50 text-violet-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-violet-200">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.99 5.73a2 2 0 0 1-2.02 0L2 7" /></svg>
                Email Campaign Builder
              </div>
              <h2 className="text-3xl font-extrabold text-slate-900 leading-snug">
                Automated drip campaigns that close deals
              </h2>
              <p className="text-slate-500 leading-relaxed">
                Build multi-step email sequences with visual IF/ELSE branching. Automatically follow up with contacts who opened or clicked.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 text-sm text-slate-600">
                  <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center mt-0.5 shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-violet-600 w-3.5 h-3.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  </div>
                  IF/ELSE logic: different paths for openers vs non-openers
                </li>
                <li className="flex items-start gap-3 text-sm text-slate-600">
                  <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center mt-0.5 shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-violet-600 w-3.5 h-3.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  </div>
                  Set delays in hours or days between each step
                </li>
                <li className="flex items-start gap-3 text-sm text-slate-600">
                  <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center mt-0.5 shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-violet-600 w-3.5 h-3.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  </div>
                  Daily send limits to protect your sender reputation
                </li>
              </ul>
              <Link href="/login">
                <button className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring border shadow h-9 px-4 py-2 gap-2 border-violet-300 text-violet-700 hover:bg-violet-50 mt-2">
                  Launch a campaign
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </button>
              </Link>
            </div>
          </div>
        </section>

        {/* Showcase Split 3: FB Ads */}
        <section className="py-24 px-4 bg-white border-b border-slate-100">
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-5 text-left">
              <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-blue-200">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-megaphone w-3.5 h-3.5">
                  <path d="m3 11 18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
                </svg>
                Facebook Ads Scraper
              </div>
              <h2 className="text-3xl font-extrabold text-slate-900 leading-snug">
                Reach businesses already spending on ads
              </h2>
              <p className="text-slate-500 leading-relaxed">
                Businesses running Facebook Ads are actively trying to grow. Find them before your competitors. The Ads Library is public — we make it easy to mine.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 text-sm text-slate-600">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center mt-0.5 shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-600 w-3.5 h-3.5"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>
                  </div>
                  Filter by keyword, industry, or location — any country
                </li>
                <li className="flex items-start gap-3 text-sm text-slate-600">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center mt-0.5 shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-600 w-3.5 h-3.5"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>
                  </div>
                  Find businesses actively spending ad budget right now
                </li>
                <li className="flex items-start gap-3 text-sm text-slate-600">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center mt-0.5 shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-600 w-3.5 h-3.5"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>
                  </div>
                  Export with ad copy samples for personalized outreach
                </li>
              </ul>
              <Link href="/login">
                <button className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring shadow h-9 px-4 py-2 gap-2 bg-blue-600 hover:bg-blue-700 text-white mt-2">
                  Find ad-running businesses
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </button>
              </Link>
            </div>

            {/* Right Side Mockup */}
            <div className="rounded-2xl border border-slate-200 bg-slate-900 shadow-xl overflow-hidden text-left">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 border-b border-slate-700">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400/70"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70"></span>
                <span className="ml-2 text-xs text-slate-500">Facebook Ads Library Scraper</span>
              </div>
              <div className="p-5 space-y-2.5">
                <div className="flex items-start gap-3 bg-slate-800 rounded-lg px-3 py-2.5 border border-slate-700/50">
                  <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-blue-400 w-3.5 h-3.5"><path d="m3 11 18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white">Gulshan Properties BD</div>
                    <div className="text-[11px] text-slate-400 truncate">Premium apartments in Gulshan & Banani. Enquire today...</div>
                  </div>
                  <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full shrink-0 font-medium">Running</span>
                </div>

                <div className="flex items-start gap-3 bg-slate-800 rounded-lg px-3 py-2.5 border border-slate-700/50">
                  <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-blue-400 w-3.5 h-3.5"><path d="m3 11 18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white">SaaS Agency Dhaka</div>
                    <div className="text-[11px] text-slate-400 truncate">Scale your software startup with local developer teams...</div>
                  </div>
                  <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full shrink-0 font-medium">Running</span>
                </div>

                <div className="flex items-start gap-3 bg-slate-800 rounded-lg px-3 py-2.5 border border-slate-700/50">
                  <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-blue-400 w-3.5 h-3.5"><path d="m3 11 18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white">EcoShop Bangladesh</div>
                    <div className="text-[11px] text-slate-400 truncate">Organic and natural groceries delivered to your door...</div>
                  </div>
                  <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full shrink-0 font-medium">Running</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works roadmap */}
        <section id="how-it-works" className="py-24 px-4 bg-slate-50">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-14 space-y-3">
              <p className="text-emerald-600 text-sm font-semibold uppercase tracking-wider">Simple process</p>
              <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900">
                From search to campaign in minutes
              </h2>
              <p className="text-slate-500 text-lg max-w-xl mx-auto">
                GetLeads is designed to get you results fast — not after a week of setup.
              </p>
            </div>

            <div className="grid md:grid-cols-4 gap-6 relative">
              {/* Step 1 */}
              <div className="relative flex flex-col items-center text-center">
                <div className="hidden md:block absolute top-6 left-[calc(50%+28px)] right-[-50%] h-0.5 bg-emerald-200"></div>
                <div className="relative w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center mb-4 z-10 shadow-lg shadow-emerald-200/60">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                </div>
                <div className="text-xs font-bold text-emerald-500 mb-1">01</div>
                <h3 className="font-bold text-slate-900 mb-2">Search leads</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Enter keyword + location on Google Maps or search Facebook Ads.
                </p>
              </div>

              {/* Step 2 */}
              <div className="relative flex flex-col items-center text-center">
                <div className="hidden md:block absolute top-6 left-[calc(50%+28px)] right-[-50%] h-0.5 bg-emerald-200"></div>
                <div className="relative w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center mb-4 z-10 shadow-lg shadow-emerald-200/60">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg>
                </div>
                <div className="text-xs font-bold text-emerald-500 mb-1">02</div>
                <h3 className="font-bold text-slate-900 mb-2">Build your list</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Save leads into your local database and filter them.
                </p>
              </div>

              {/* Step 3 */}
              <div className="relative flex flex-col items-center text-center">
                <div className="hidden md:block absolute top-6 left-[calc(50%+28px)] right-[-50%] h-0.5 bg-emerald-200"></div>
                <div className="relative w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center mb-4 z-10 shadow-lg shadow-emerald-200/60">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.99 5.73a2 2 0 0 1-2.02 0L2 7" /></svg>
                </div>
                <div className="text-xs font-bold text-emerald-500 mb-1">03</div>
                <h3 className="font-bold text-slate-900 mb-2">Launch campaign</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Connect SMTP and write your follow-up sequence.
                </p>
              </div>

              {/* Step 4 */}
              <div className="relative flex flex-col items-center text-center">
                <div className="relative w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center mb-4 z-10 shadow-lg shadow-emerald-200/60">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /><line x1="3" y1="20" x2="21" y2="20" /></svg>
                </div>
                <div className="text-xs font-bold text-emerald-500 mb-1">04</div>
                <h3 className="font-bold text-slate-900 mb-2">Close more deals</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Monitor reply analytics and book direct discovery calls.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials section */}
        <section className="py-24 px-4 bg-white">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14 space-y-3">
              <p className="text-emerald-600 text-sm font-semibold uppercase tracking-wider">What our users say</p>
              <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900">
                Loved by sales teams in Bangladesh
              </h2>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
              {/* Testimonial 1 */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-7 text-white space-y-4 text-left">
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-amber-400"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                  ))}
                </div>
                <p className="text-slate-200 text-sm leading-relaxed">
                  "GetLeads helped us find 500+ restaurant leads in Dhaka in less than 10 minutes. The automated follow-up sequences booked us 15 meetings in our first week."
                </p>
                <div className="flex items-center gap-3 pt-2">
                  <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center font-bold text-sm text-white">
                    R
                  </div>
                  <div>
                    <div className="font-semibold text-sm">Rahman Khan</div>
                    <div className="text-slate-400 text-xs">Founder, DhakaFood Co.</div>
                  </div>
                </div>
              </div>

              {/* Testimonial 2 */}
              <div className="bg-white rounded-2xl border border-slate-100 p-7 space-y-4 shadow-sm text-left">
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-amber-400"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                  ))}
                </div>
                <p className="text-slate-600 text-sm leading-relaxed">
                  "We scraped 800 pharmacy stores in Chittagong in one afternoon. Within 2 weeks of cold email outreach campaigns, we secured 12 new distributor contracts."
                </p>
                <div className="flex items-center gap-3 pt-2">
                  <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center font-bold text-sm text-white">
                    S
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-slate-900">Salma Begum</div>
                    <div className="text-slate-400 text-xs">BD Manager, MedSupply BD</div>
                  </div>
                </div>
              </div>

              {/* Testimonial 3 */}
              <div className="bg-white rounded-2xl border border-slate-100 p-7 space-y-4 shadow-sm text-left">
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-amber-400"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                  ))}
                </div>
                <p className="text-slate-600 text-sm leading-relaxed">
                  "Before GetLeads I was spending 2 hours a day copy-pasting contacts. Now I scrape a full list in 3 minutes and send personalized outreach sequences on autopilot."
                </p>
                <div className="flex items-center gap-3 pt-2">
                  <div className="w-9 h-9 rounded-full bg-violet-500 flex items-center justify-center font-bold text-sm text-white">
                    K
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-slate-900">Karim Uddin</div>
                    <div className="text-slate-400 text-xs">Owner, Karim Digital Agency</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-24 px-4 bg-slate-50">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14 space-y-3">
              <div className="inline-flex items-center gap-2 bg-amber-50 text-amber-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-amber-200">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                Credit-based pricing
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900">
                Simple, transparent pricing
              </h2>
              <p className="text-slate-500 text-lg">
                1 credit = 1 lead. Buy once, use anytime. No monthly subscription.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Plan 1 */}
              <div className="relative bg-white rounded-2xl p-8 border border-slate-200 shadow-sm hover:shadow-md transition-all text-left">
                <div className="mb-5">
                  <div className="font-extrabold text-xl text-slate-900">Starter</div>
                  <div className="text-sm text-slate-400 mt-0.5">Great for small businesses</div>
                </div>
                <div className="mb-1">
                  <span className="text-5xl font-extrabold text-slate-900">৳490</span>
                </div>
                <p className="text-sm text-slate-400 mb-6">one-time payment</p>
                <ul className="space-y-2.5 text-sm text-slate-600 mb-8">
                  <li className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-500"><polyline points="20 6 9 17 4 12"/></svg>
                    3,000 lead credits
                  </li>
                  <li className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-500"><polyline points="20 6 9 17 4 12"/></svg>
                    Google Maps + FB Ads
                  </li>
                  <li className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-500"><polyline points="20 6 9 17 4 12"/></svg>
                    Email campaign builder
                  </li>
                  <li className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-500"><polyline points="20 6 9 17 4 12"/></svg>
                    CSV export included
                  </li>
                  <li className="flex items-center gap-2 text-slate-400 font-medium">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-300"><polyline points="20 6 9 17 4 12"/></svg>
                    ৳0.16 per lead
                  </li>
                </ul>
                <Link href="/login?redirect=/credits">
                  <button className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground px-4 py-2 w-full h-11 font-semibold">
                    Get Started
                  </button>
                </Link>
              </div>

              {/* Plan 2: Pro */}
              <div className="relative bg-white rounded-2xl p-8 border border-emerald-400 shadow-xl shadow-emerald-100 ring-2 ring-emerald-400 scale-[1.03] text-left">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-bold px-4 py-1.5 rounded-full flex items-center gap-1 shadow-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                  Most Popular
                </div>
                <div className="mb-5">
                  <div className="font-extrabold text-xl text-slate-900">Pro</div>
                  <div className="text-sm text-slate-400 mt-0.5">Most popular choice</div>
                </div>
                <div className="mb-1">
                  <span className="text-5xl font-extrabold text-slate-900">৳1,490</span>
                </div>
                <p className="text-sm text-slate-400 mb-6">one-time payment</p>
                <ul className="space-y-2.5 text-sm text-slate-600 mb-8">
                  <li className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-500"><polyline points="20 6 9 17 4 12"/></svg>
                    15,000 lead credits
                  </li>
                  <li className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-500"><polyline points="20 6 9 17 4 12"/></svg>
                    Google Maps + FB Ads
                  </li>
                  <li className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-500"><polyline points="20 6 9 17 4 12"/></svg>
                    Email campaign builder
                  </li>
                  <li className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-500"><polyline points="20 6 9 17 4 12"/></svg>
                    CSV export included
                  </li>
                  <li className="flex items-center gap-2 text-emerald-600 font-bold">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-500"><polyline points="20 6 9 17 4 12"/></svg>
                    ৳0.10 per lead
                  </li>
                </ul>
                <Link href="/login?redirect=/credits">
                  <button className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring px-4 py-2 w-full h-11 font-semibold bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-200">
                    Get Started
                  </button>
                </Link>
              </div>

              {/* Plan 3: Business */}
              <div className="relative bg-white rounded-2xl p-8 border border-slate-200 shadow-sm hover:shadow-md transition-all text-left">
                <div className="mb-5">
                  <div className="font-extrabold text-xl text-slate-900">Business</div>
                  <div className="text-sm text-slate-400 mt-0.5">For agencies & power users</div>
                </div>
                <div className="mb-1">
                  <span className="text-5xl font-extrabold text-slate-900">৳2,950</span>
                </div>
                <p className="text-sm text-slate-400 mb-6">one-time payment</p>
                <ul className="space-y-2.5 text-sm text-slate-600 mb-8">
                  <li className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-500"><polyline points="20 6 9 17 4 12"/></svg>
                    40,000 lead credits
                  </li>
                  <li className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-500"><polyline points="20 6 9 17 4 12"/></svg>
                    Google Maps + FB Ads
                  </li>
                  <li className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-500"><polyline points="20 6 9 17 4 12"/></svg>
                    Email campaign builder
                  </li>
                  <li className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-500"><polyline points="20 6 9 17 4 12"/></svg>
                    CSV export included
                  </li>
                  <li className="flex items-center gap-2 text-slate-400 font-medium">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-300"><polyline points="20 6 9 17 4 12"/></svg>
                    ৳0.07 per lead
                  </li>
                </ul>
                <Link href="/login?redirect=/credits">
                  <button className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground px-4 py-2 w-full h-11 font-semibold">
                    Get Started
                  </button>
                </Link>
              </div>
            </div>

            <div className="mt-8 text-center flex items-center justify-center gap-6 text-sm text-slate-500 flex-wrap">
              <span className="flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-500"><polyline points="20 6 9 17 4 12"/></svg>
                No subscription
              </span>
              <span className="flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-500"><polyline points="20 6 9 17 4 12"/></svg>
                Credits never expire
              </span>
              <span className="flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-500"><polyline points="20 6 9 17 4 12"/></svg>
                Secure payments
              </span>
              <span className="flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-500"><polyline points="20 6 9 17 4 12"/></svg>
                Instant activation
              </span>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="py-24 px-4 bg-white">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-14 space-y-3">
              <p className="text-emerald-600 text-sm font-semibold uppercase tracking-wider">FAQ</p>
              <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900">
                Frequently asked questions
              </h2>
              <p className="text-slate-500 text-lg">
                Everything you need to know before getting started.
              </p>
            </div>

            <div className="space-y-3">
              {faqs.map((faq, index) => (
                <div key={index} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <button 
                    onClick={() => toggleFaq(index)} 
                    className="w-full flex items-center justify-between px-5 py-4 text-left font-semibold text-slate-900 hover:bg-slate-50 transition text-sm focus:outline-none"
                  >
                    <span>{faq.q}</span>
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      width="24" 
                      height="24" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      className="lucide lucide-chevron-down w-4 h-4 text-slate-400 transition-transform shrink-0 ml-4"
                      style={{ transform: faqOpen === index ? "rotate(180deg)" : "none" }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  {faqOpen === index && (
                    <div className="px-5 pb-4 text-sm text-slate-500 bg-white leading-relaxed border-t border-slate-50 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trust Badges Section */}
        <section className="py-16 px-4 bg-slate-50 border-t border-slate-100">
          <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-8 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <h3 className="font-bold text-slate-900">Secure & Private</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                All data is encrypted and stored securely. We never share your leads database with third parties.
              </p>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </div>
              <h3 className="font-bold text-slate-900">Lightning Fast</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Scrape thousands of leads in minutes. Real-time results with no waiting around.
              </p>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
                  <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>
              <h3 className="font-bold text-slate-900">Works Everywhere</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Search any business in any country. Worldwide Google Maps and Facebook Ads Library coverage.
              </p>
            </div>
          </div>
        </section>

        {/* CTA section banner */}
        <section className="py-24 px-4 bg-gradient-to-br from-emerald-500 to-teal-600">
          <div className="max-w-2xl mx-auto text-center space-y-5">
            <h2 className="text-3xl md:text-4xl font-extrabold text-white">
              Start generating leads in Bangladesh today
            </h2>
            <p className="text-emerald-100 text-lg">
              Get started absolutely free. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Link href="/login">
                <button className="inline-flex items-center justify-center whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-md bg-white text-emerald-700 hover:bg-emerald-50 px-8 h-12 text-base font-semibold gap-2 shadow-lg">
                  Get Started Free
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </button>
              </Link>
            </div>
            <p className="text-emerald-200 text-sm">
              Questions? Email us at support@getleads.pro
            </p>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t bg-slate-900 py-14 px-4 text-left">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row items-start justify-between gap-10 mb-10">
              <div className="flex flex-col gap-3 max-w-xs">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center font-bold text-white text-base shadow-sm">
                    GL
                  </div>
                  <span className="text-xl font-extrabold text-white tracking-tight">
                    Get<span className="text-emerald-500">Leads</span>
                  </span>
                </div>
                <p className="text-slate-400 text-sm leading-relaxed">
                  The global lead generation and email outreach platform. Built for agencies and freelancers in Bangladesh.
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-8 text-sm">
                <div className="space-y-3">
                  <p className="font-semibold text-white text-xs uppercase tracking-wider">Product</p>
                  <div className="space-y-2.5 text-slate-400">
                    <a className="block hover:text-white transition" href="#features">Features</a>
                    <a className="block hover:text-white transition" href="#pricing">Pricing</a>
                    <a className="block hover:text-white transition" href="#how-it-works">How it works</a>
                    <a className="block hover:text-white transition" href="#faq">FAQ</a>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="font-semibold text-white text-xs uppercase tracking-wider">Resources</p>
                  <div className="space-y-2.5 text-slate-400">
                    <Link className="block hover:text-white transition" href="/unsubscribe">Unsubscribe</Link>
                    <a className="block hover:text-white transition" href="mailto:support@getleads.pro">Support</a>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="font-semibold text-white text-xs uppercase tracking-wider">Account</p>
                  <div className="space-y-2.5 text-slate-400">
                    <Link className="block hover:text-white transition" href="/login">Sign In</Link>
                    <Link className="block hover:text-white transition" href="/login">Sign Up Free</Link>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
              <p className="text-slate-500 text-xs">
                © {new Date().getFullYear()} GetLeads. All rights reserved.
              </p>
              <p className="text-slate-500 text-xs">
                support@getleads.pro
              </p>
            </div>
          </div>
        </footer>

      </div>
    </div>
  );
}
