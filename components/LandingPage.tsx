import React from 'react';

interface LandingPageProps {
    onLogin: () => void;
}

// FIX: Explicitly typing as React.FC to properly handle children in JSX
const FeatureIcon: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4">
        {children}
    </div>
);

const PricingCard = ({ 
    title, 
    price, 
    period, 
    features, 
    isPopular, 
    onSelect,
    colorClass 
}: { 
    title: string; 
    price: string; 
    period: string; 
    features: string[]; 
    isPopular?: boolean; 
    onSelect: () => void;
    colorClass: string;
}) => (
    <div className={`relative p-8 rounded-3xl border transition-all duration-500 hover:-translate-y-2 flex flex-col h-full ${isPopular ? 'bg-slate-900 border-indigo-500 shadow-[0_20px_60_rgba(79,70,229,0.2)]' : 'bg-slate-900/50 border-white/10 hover:border-white/20'}`}>
        {isPopular && (
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-500 to-cyan-500 text-white text-[10px] font-black px-4 py-1 rounded-full uppercase tracking-widest shadow-lg">
                Most Popular
            </div>
        )}
        <h3 className="text-xl font-black text-white uppercase tracking-wider mb-2">{title}</h3>
        <div className="flex items-baseline gap-1 mb-6">
            <span className="text-4xl font-black text-white">{price}</span>
            <span className="text-slate-500 text-sm font-bold">/{period}</span>
        </div>
        <ul className="space-y-4 mb-8 flex-grow">
            {features.map((f, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-slate-400">
                    <span className="text-emerald-500 mt-1">✓</span>
                    {f}
                </li>
            ))}
        </ul>
        <button 
            type="button"
            onClick={(e) => {
                e.preventDefault();
                onSelect();
            }}
            className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-xs transition-all cursor-pointer relative z-10 ${colorClass}`}
        >
            Select Plan
        </button>
    </div>
);

const LandingPage: React.FC<LandingPageProps> = ({ onLogin }) => {
    const handleSmoothScroll = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
        e.preventDefault();
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 overflow-x-hidden selection:bg-indigo-500/30">
            {/* Background Decor */}
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] -mr-40 -mt-40"></div>
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-cyan-600/10 rounded-full blur-[100px] -ml-20 -mb-20"></div>
            </div>

            <div className="relative z-10">
                {/* Nav */}
                <nav className="container mx-auto px-6 py-8 flex justify-between items-center relative z-20">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-xl shadow-[0_0_20px_rgba(79,70,229,0.4)]">📡</div>
                        <span className="text-xl font-black uppercase tracking-[0.3em] text-white">RF SUITE</span>
                    </div>
                    <div className="hidden md:flex items-center gap-10">
                        <a href="#features" onClick={(e) => handleSmoothScroll(e, 'features')} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors">Features</a>
                        <a href="#pricing" onClick={(e) => handleSmoothScroll(e, 'pricing')} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors">Pricing</a>
                        <button 
                            type="button"
                            onClick={() => onLogin()}
                            className="px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all cursor-pointer"
                        >
                            Sign In
                        </button>
                    </div>
                </nav>

                {/* Hero Section */}
                <section className="container mx-auto px-6 pt-20 pb-32 relative">
                    <div className="max-w-4xl relative z-10">
                        <div className="inline-block px-4 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-[0.4em] mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            Professional Spectral Coordination
                        </div>
                        <h1 className="text-6xl md:text-8xl font-black text-white mb-8 tracking-tighter leading-[0.9] animate-in fade-in slide-in-from-bottom-6 duration-1000">
                            Coordinate Your <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Spectrum</span>
                        </h1>
                        <p className="text-slate-400 text-lg md:text-xl max-w-2xl mb-12 leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-1000">
                            A high-precision ecosystem for RF professionals. 
                            From festivals to world tours, manage your wireless complexity with intelligence and confidence.
                        </p>
                        <div className="flex flex-wrap gap-4 animate-in fade-in slide-in-from-bottom-10 duration-1000">
                            <button onClick={() => onLogin()} className="px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest text-sm shadow-[0_20px_50px_rgba(79,70,229,0.3)] transition-all transform hover:-translate-y-1">
                                Launch RF Suite
                            </button>
                            <button onClick={(e) => { e.preventDefault(); document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' }); }} className="px-8 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-black uppercase tracking-widest text-sm transition-all">
                                Explore Features
                            </button>
                        </div>
                    </div>
                </section>

                {/* Features Section */}
                <section id="features" className="container mx-auto px-6 py-32 border-t border-white/5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                        <div>
                            <FeatureIcon>🧪</FeatureIcon>
                            <h3 className="text-lg font-black text-white uppercase mb-4 tracking-wider">Physics Engine</h3>
                            <p className="text-slate-400 text-sm leading-relaxed">Advanced intermod calculation using combinatorial analysis for 2-tone and 3-tone 3rd order products across the entire spectrum.</p>
                        </div>
                        <div>
                            <FeatureIcon>🌍</FeatureIcon>
                            <h3 className="text-lg font-black text-white uppercase mb-4 tracking-wider">Spatial Logic</h3>
                            <p className="text-slate-400 text-sm leading-relaxed">Distance-aware coordination allowing intelligent frequency reuse across large festival sites and multi-zone industrial venues.</p>
                        </div>
                        <div>
                            <FeatureIcon>📊</FeatureIcon>
                            <h3 className="text-lg font-black text-white uppercase mb-4 tracking-wider">Real-time Analysis</h3>
                            <p className="text-slate-400 text-sm leading-relaxed">High-fidelity spectral visualization with support for CSV scan imports, peak-hold, and waterfall time-tracking displays.</p>
                        </div>
                    </div>
                </section>

                {/* Pricing Section */}
                <section id="pricing" className="container mx-auto px-6 py-32 border-t border-white/5">
                    <div className="text-center mb-20">
                        <h2 className="text-4xl font-black text-white uppercase tracking-tighter mb-4">Professional Plans</h2>
                        <p className="text-slate-500 uppercase font-black text-[10px] tracking-[0.3em]">Scalable intelligence for any size production</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                        <PricingCard 
                            title="48 Hour Pass" 
                            price="$4.99" 
                            period="48h" 
                            features={["Full Pro Access", "Unlimited Channels", "Export .rfproject", "Priority Support", "Single Event Use"]} 
                            onSelect={onLogin}
                            colorClass="bg-slate-800 hover:bg-slate-700 text-white"
                        />
                        <PricingCard 
                            title="7 Day Pass" 
                            price="$10.99" 
                            period="7d" 
                            isPopular 
                            features={["Full Pro Access", "Unlimited Channels", "Export .rfproject", "Priority Support", "Multi-Event Use", "Perfect for Festivals"]} 
                            onSelect={onLogin}
                            colorClass="bg-indigo-600 hover:bg-indigo-500 text-white"
                        />
                        <PricingCard 
                            title="1 Month Pro" 
                            price="$24.99" 
                            period="mo" 
                            features={["Full Pro Access", "Unlimited Channels", "Export .rfproject", "Priority Support", "Continuous Updates", "Best Value for Pros"]} 
                            onSelect={onLogin}
                            colorClass="bg-slate-800 hover:bg-slate-700 text-white"
                        />
                    </div>
                </section>
                
                {/* Footer */}
                <footer className="container mx-auto px-6 py-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex flex-col gap-2">
                        <div className="text-slate-600 text-[10px] font-black uppercase tracking-[0.2em]">
                            &copy; {new Date().getFullYear()} RF SUITE PRECISION LOGIC. ALL RIGHTS RESERVED.
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[8px] text-slate-500 font-black uppercase tracking-widest">Global Infrastructure Operational</span>
                        </div>
                    </div>
                    <div className="flex gap-8">
                        <span className="text-slate-600 text-[10px] font-black uppercase tracking-[0.2em]">V2.5.0 STABLE</span>
                        <a href="#" className="text-slate-600 text-[10px] font-black uppercase tracking-[0.2em] hover:text-slate-400 transition-colors">Privacy</a>
                        <a href="#" className="text-slate-600 text-[10px] font-black uppercase tracking-[0.2em] hover:text-slate-400 transition-colors">Terms</a>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default LandingPage;
