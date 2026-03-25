import React from 'react';
import { Newspaper } from 'lucide-react';

const newsItems = [
  {
    id: 1,
    title: "RF Suite 2.0 Released",
    date: "2026-03-01",
    summary: "Introducing real-time waterfall visualization and enhanced multi-band logic."
  },
  {
    id: 2,
    title: "New Hardware Integration: TinySA Ultra",
    date: "2026-02-15",
    summary: "Direct Web Serial support for the TinySA Ultra is now available."
  },
  {
    id: 3,
    title: "RF Coordination Best Practices for Festivals",
    date: "2026-01-20",
    summary: "A deep dive into managing high-density spectral environments."
  }
];

export const NewsFeed: React.FC = () => {
  return (
    <div className="bg-slate-900/50 p-8 rounded-3xl border border-white/5">
      <div className="flex items-center gap-3 mb-8">
        <Newspaper className="text-indigo-400" size={24} />
        <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Latest News</h2>
      </div>
      <div className="space-y-6">
        {newsItems.map(item => (
          <div key={item.id} className="border-b border-white/5 pb-6 last:border-0 last:pb-0">
            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{item.date}</span>
            <h4 className="text-sm font-black text-white uppercase tracking-widest mt-1 mb-2">{item.title}</h4>
            <p className="text-xs text-slate-400 leading-relaxed">{item.summary}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
